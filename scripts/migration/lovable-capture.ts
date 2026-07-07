/**
 * Story 9.2 — the LOVABLE FIXTURE CAPTURE script (LOCAL / TEST-ORIENTED / REPEATABLE).
 *
 * ── WHAT THIS IS ──────────────────────────────────────────────────────────────────────────
 * A DOCUMENTED, LOCAL, REPEATABLE capture helper that proves the anonymization + capture PIPELINE
 * for the anonymized Lovable golden fixtures (`tests/fixtures/golden/lovable/**`). It exports a PURE,
 * DETERMINISTIC `anonymizeRecord` that maps a source record's PII/secret leaves to obviously-synthetic
 * placeholders BEFORE anything is ever written to disk or a log (anonymize AT SOURCE, R-901). The
 * anonymized output satisfies the SAME shared privacy scanner (`@/tests-support/anonymization-scan`)
 * the committed fixtures are held to.
 *
 * ── STORY STOP CONDITION — SYNTHETIC INPUT ONLY ─────────────────────────────────────────────
 * This story's INPUT is SYNTHETIC / representative sample data — NOT a live real-Lovable pull. The
 * real-capture record SELECTION (which real Lovable records become the oracle) is OWNER-GATED
 * (Sign-Off 8.1/8.2, `öppen (möte)`), and any real customer-data export/import is a HARD STOP
 * requiring owner sign-off (Story 9.2 Stop Condition). This script deliberately connects to NOTHING:
 * no network, no DB, no real Lovable connection, no global/system change, no dependency. It proves the
 * pipeline works + is repeatable; backfilling REAL captured values happens later, with NO fixture-
 * schema change (the three-way `origin` already accommodates a real `old-lovable` case).
 *
 * ── DEFENSE-IN-DEPTH (R-901/R-902) ─────────────────────────────────────────────────────────
 *   - Anonymize AT SOURCE: `anonymizeRecord` maps real -> synthetic; a raw value is NEVER written or
 *     echoed. `captureLog` (below) logs COUNTS/IDS only ("anonymized 12 customers"), never a raw name.
 *   - DETERMINISTIC: replacements are seeded/fixed (indexed synthetic labels + a fixed hash of the key
 *     path), so re-running the capture on the same input produces BYTE-IDENTICAL output (AC2 repeatable).
 *   - PURE: `anonymizeRecord` does NOT mutate its input — it returns a fresh object (no raw value can
 *     leak back through an in-place edit).
 *   - Secrets are DROPPED entirely (never masked-in-place — a masked secret key still reads as a leak).
 *
 * [Source: architecture.md#16 (scripts/migration/**); epics.md#Story 9.2 AC2 + Stop Conditions;
 *  test-design-epic-9.md 9.2-REPEAT-01, 9.2-PRIV-02, R-901/R-902/R-918/R-919, 9.x-PATH-01;
 *  project-context.md#Lovable Oracle Policy; PRD NFR17]
 */

/** A plain JSON-ish record the anonymizer operates over. */
export type Record_ = Record<string, unknown>;

// ── Key-name heuristics: which keys carry which PII class (case-insensitive substring match) ──
const NAME_KEYS = /(^|_)(name|first_?name|last_?name|full_?name|display_?name|contact_?name|customer_?name)($|_)/i;
const EMAIL_KEYS = /email/i;
const PERSONNUMMER_KEYS = /(personnummer|personal_?number|ssn|pnr)/i;
const ORGNR_KEYS = /(org_?nr|org_?number|orgnummer|organisation_?number|organization_?number)/i;
const PHONE_KEYS = /(phone|mobile|tel|telefon)/i;
const ADDRESS_KEYS = /(address|street|adress|gatuadress)/i;
// Secret keys are DROPPED entirely (never masked-in-place).
const SECRET_KEYS = /(secret|password|passwd|api_?key|apikey|token|access_?key|private_?key)/i;

/**
 * A stable, dependency-free 32-bit hash (FNV-1a) of a string — used to derive a DETERMINISTIC
 * synthetic index/suffix from a value or key path, so re-running produces byte-identical output
 * (no `Math.random`, no clock). NEVER reversible to the source value (one-way; the raw value is not
 * retained anywhere).
 */
function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic synthetic replacements per PII class. Each takes the (never-retained) raw value ONLY
 * to derive a stable synthetic suffix — the returned placeholder is obviously fake and canNOT match
 * the privacy regexes:
 *   - name        -> "Sample Person NN"       (synthetic label)
 *   - email       -> "user-NN@example.test"   (the sanctioned example.test domain)
 *   - personnummer-> "YYMMDD-XXXX"            (masked, NON-\d{6}-\d{4})
 *   - orgnr       -> "XXXXXX-XXXX"            (masked, NON-\d{10})
 *   - phone       -> "07X-XXX XX XX"          (masked, non-matching SE mobile shape)
 *   - address     -> "Sample street NN"       (NOTE: NO street-type word + number, so it does NOT
 *                                              match the ADDRESS heuristic — "street" alone with a
 *                                              LETTER-prefixed number-word is safe)
 */
function syntheticName(raw: string): string {
  return `Sample Person ${(stableHash(raw) % 100).toString().padStart(2, "0")}`;
}
function syntheticEmail(raw: string): string {
  return `user-${(stableHash(raw) % 100).toString().padStart(2, "0")}@example.test`;
}
function syntheticPersonnummer(): string {
  // Masked placeholder — deliberately NOT the \d{6}-\d{4} shape (letters where digits would be).
  return "YYMMDD-XXXX";
}
function syntheticOrgnr(): string {
  // Masked placeholder — deliberately NOT a 10-digit run.
  return "XXXXXX-XXXX";
}
function syntheticPhone(): string {
  // Masked — the digits are Xs so it cannot match the SE-mobile PHONE regex.
  return "07X-XXX XX XX";
}
function syntheticAddress(raw: string): string {
  // "Sample gata" would match the ADDRESS heuristic only if followed by a bare number — we emit a
  // LETTER-suffixed placeholder ("Sample plats A") with NO street-type-word + digit pair, so the
  // ADDRESS regex (street-type word + \d+) does not match.
  const suffix = String.fromCharCode(65 + (stableHash(raw) % 26)); // A..Z
  return `Sample plats ${suffix}`;
}

/** Classify a key -> the PII class it carries (or null for a non-PII key). */
type PiiClass = "name" | "email" | "personnummer" | "orgnr" | "phone" | "address" | "secret" | null;
function classifyKey(key: string): PiiClass {
  // Secret first (drop wins over any other interpretation), then the most specific shapes.
  if (SECRET_KEYS.test(key)) return "secret";
  if (PERSONNUMMER_KEYS.test(key)) return "personnummer";
  if (ORGNR_KEYS.test(key)) return "orgnr";
  if (EMAIL_KEYS.test(key)) return "email";
  if (PHONE_KEYS.test(key)) return "phone";
  if (ADDRESS_KEYS.test(key)) return "address";
  if (NAME_KEYS.test(key)) return "name";
  return null;
}

/** Replace a string value per its classified PII class (deterministic, obviously-synthetic). */
function replaceByClass(cls: Exclude<PiiClass, null | "secret">, raw: string): string {
  switch (cls) {
    case "name":
      return syntheticName(raw);
    case "email":
      return syntheticEmail(raw);
    case "personnummer":
      return syntheticPersonnummer();
    case "orgnr":
      return syntheticOrgnr();
    case "phone":
      return syntheticPhone();
    case "address":
      return syntheticAddress(raw);
  }
}

/**
 * PURE, DETERMINISTIC anonymizer. Returns a FRESH deeply-anonymized copy of `record`; the input is
 * NEVER mutated (no raw value can leak back out through an in-place edit). Secrets are DROPPED
 * (the key is omitted entirely). Nested objects/arrays are recursed. A non-PII scalar is copied
 * verbatim (öre integers, flags, ids — the load-bearing business shape 9.3 depends on is preserved).
 *
 * ── KNOWN LIMITATION — free-form personal NAMES are NOT auto-anonymized (manual redaction required) ──
 * A personal NAME is replaced only when the field KEY matches `NAME_KEYS`. A real name typed into a
 * free-form / notes leaf under a NON-name key (e.g. `notes: "Contact Anna Andersson…"`) passes through
 * VERBATIM — `anonymizeUnhintedString` (the value-shape backstop) masks personnummer/orgnr/phone/
 * address/email SHAPES but has NO name detector (a name has no regex shape distinct from ordinary
 * prose), and the shared CI scanner likewise has no name class. This is a defense-in-depth gap
 * reachable only via a future real-capture story (the committed 9.2 fixtures are synthetic-only, and
 * real-capture SELECTION is an owner-gated HARD STOP). BEFORE any REAL data is captured/committed,
 * free-form fields MUST be manually redacted (or run through an allowlist / NER pass) — do NOT rely on
 * this function to strip a name embedded in free-form text. See scripts/migration/README.md.
 */
export function anonymizeRecord(record: Record_): Record_ {
  return anonymizeObject(record) as Record_;
}

function anonymizeValue(value: unknown, keyHint: PiiClass): unknown {
  if (typeof value === "string") {
    if (keyHint && keyHint !== "secret") return replaceByClass(keyHint, value);
    // No key hint: a string that STILL matches a PII shape by value is defensively replaced so a
    // mislabeled/free-form field cannot smuggle a raw value through.
    return anonymizeUnhintedString(value);
  }
  if (Array.isArray(value)) return value.map((v) => anonymizeValue(v, null));
  if (value && typeof value === "object") return anonymizeObject(value as Record_);
  // number / boolean / null — verbatim (business shape).
  return value;
}

function anonymizeObject(obj: Record_): Record_ {
  const out: Record_ = {};
  for (const [key, value] of Object.entries(obj)) {
    const cls = classifyKey(key);
    if (cls === "secret") continue; // DROP the key entirely — never mask a secret in place.
    out[key] = anonymizeValue(value, cls);
  }
  return out;
}

// ── Value-shape guards for unhinted free-form strings (defense-in-depth) ──
const PERSONNUMMER_RE = /\b\d{6}-\d{4}\b/;
const ORGNR_RE = /\b\d{10}\b/;
const NON_EXAMPLE_EMAIL_RE = /@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?46|0)\s?7\d(?:[\s-]?\d){7}\b/;
const ADDRESS_RE = /\b(gata|gatan|väg|vägen|street|road|avenue)\s+\d+/i;

/**
 * A free-form (unhinted) string that HAPPENS to carry a PII SHAPE is masked to a safe placeholder.
 * NOTE — this backstop covers only shapes with a distinguishable regex (personnummer/orgnr/phone/
 * address/email). It does NOT — and cannot — detect a personal NAME embedded in prose (a name has no
 * regex shape distinct from ordinary text). A real name in a free-form field therefore passes through
 * verbatim; it requires manual redaction / an allowlist / NER pass before any real capture. See the
 * limitation note on `anonymizeRecord` and scripts/migration/README.md.
 */
function anonymizeUnhintedString(value: string): string {
  if (PERSONNUMMER_RE.test(value)) return syntheticPersonnummer();
  if (ORGNR_RE.test(value)) return syntheticOrgnr();
  if (PHONE_RE.test(value)) return syntheticPhone();
  if (ADDRESS_RE.test(value)) return syntheticAddress(value);
  if (NON_EXAMPLE_EMAIL_RE.test(value)) return syntheticEmail(value);
  return value;
}

/**
 * A capture LOGGER that emits COUNTS/IDS ONLY — NEVER a raw value (R-901/R-902 defense-in-depth). Use
 * this instead of `console.log(record)` in any capture run so a name/email/personnummer can never
 * reach stdout or a committed log. Returns the formatted line (also for testability) without echoing.
 */
export function captureLog(counts: Readonly<Record<string, number>>): string {
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${k}`);
  return `anonymized ${parts.join(", ")}`;
}

// Default export mirrors `anonymizeRecord` so the scaffold's `mod.default` probe also resolves.
export default anonymizeRecord;
