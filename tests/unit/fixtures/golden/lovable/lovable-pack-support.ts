/**
 * Story 9.2 — SHARED test-support helpers for the anonymized Lovable golden pack (RED-PHASE SCAFFOLD).
 *
 * This module is the SINGLE point every 9.2 suite imports so the four suites
 * (privacy-scan / shape-guard / loader-round-trip / seeded-PII negative control) agree on:
 *   - where the Lovable fixtures live (GOLDEN_LOVABLE_DIR),
 *   - which shared anonymization scanner the dev extracted out of the money golden-pack,
 *   - the surface-present probe that gates every suite for the TDD red phase.
 *
 * ── RED-PHASE STATUS ──────────────────────────────────────────────────────────────────
 * The dev has NOT yet created the shared scanner module or the `tests/fixtures/golden/lovable/**`
 * fixtures. `lovablePackPresent()` returns FALSE until BOTH exist, so every suite gates behind
 * `describe.skip` and the current green unit baseline (1259 pass / 0 fail) stays UNPERTURBED.
 * When the dev lands the scanner + fixtures, the probe flips true automatically and the UNCHANGED
 * assertions run — no test edit. Do NOT delete the probe; do NOT convert a suite to a hard
 * `describe(...)` that throws on the absent surface (that would break the red-phase baseline).
 *
 * ── WHAT THE DEV MUST CREATE (green phase) ────────────────────────────────────────────
 *   1. A SHARED anonymization scanner module (extracted from golden-pack.test.ts:379-418) at
 *      `tests/support/anonymization-scan.ts` (Task 1.2 — pick ONE home; this scaffold expects
 *      that path — if the dev colocates it under `tests/fixtures/golden/lovable/scan.ts` instead,
 *      update SCANNER_MODULE below to match — ONE authority, not a copy-pasted regex set).
 *      The money-pack scan MUST keep passing (consume the shared scanner or leave it byte-identical).
 *   2. `tests/fixtures/golden/lovable/` JSON fixtures — one anonymized fixture per business category
 *      (Task 2), each origin/note/_doc-schema'd, öre < 10 digits, real ReadinessCode members only.
 *   3. An EXPLICIT fixture manifest (Task 1.4) so the scan enumerates every fixture by name AND a
 *      directory-glob backstop so a newly-added fixture cannot escape the scan.
 *
 * NO PII IN THIS FILE. Seeded-PII positive-control values are constructed INLINE in the negative-
 * control test, never written to a `lovable/**` fixture (that would trip the real scan). [R-901]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The canonical home for the anonymized Lovable fixtures (architecture §16/§17). NEW in 9.2 — this
 * is the FIRST fixtures dir carrying real `old-lovable`/`documented-delta` origins.
 */
export const GOLDEN_LOVABLE_DIR = resolve(HERE, "../../../../fixtures/golden/lovable");

/**
 * The shared anonymization scanner module the dev extracts out of the money golden-pack (Task 1.2).
 * A single authority — the money-pack scan must KEEP passing (consume this, or stay byte-identical).
 * If the dev colocates the scanner elsewhere, update this specifier + `loadScanner()` to match.
 */
export const SCANNER_MODULE = "@/tests-support/anonymization-scan";

/**
 * Attempt to load the shared scanner. Returns null if the dev has not created it yet (red phase).
 * The GREEN scanner MUST export a callable that runs each PII class as its OWN assertion/violation
 * so a failure names WHICH class tripped (Task 1.2). This scaffold uses a tolerant shape:
 *   scanFixtureData(fixtureObject) -> { violations: Array<{ class: string; file?: string }> }
 * OR a throwing `assertNoPii(fixtureObject, label)`. The dev picks one; the suites below probe both.
 */
export async function loadScanner(): Promise<Record<string, unknown> | null> {
  try {
    // Dynamic import so an ABSENT module does not crash the module graph in the red phase.
    // The dev wires the real path via tsconfig `paths` or the alias-hook; if that mapping is not
    // present yet, the catch keeps the suite skippable rather than erroring at import time.
    const mod = (await import(SCANNER_MODULE)) as Record<string, unknown>;
    return mod;
  } catch {
    return null;
  }
}

/** True once BOTH the fixture dir AND at least one committed Lovable fixture exist. */
export function lovableFixtureDirPresent(): boolean {
  if (!existsSync(GOLDEN_LOVABLE_DIR)) return false;
  return listLovableFixtureFiles().length >= 1;
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

export function readJson(absPath: string): unknown {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

/** The three-way origin discipline the whole golden estate uses. */
export const ORIGINS = ["old-lovable", "new-expected", "documented-delta"] as const;
export type Origin = (typeof ORIGINS)[number];
export function isValidOrigin(v: unknown): v is Origin {
  return typeof v === "string" && (ORIGINS as readonly string[]).includes(v);
}

/**
 * The REAL exported ReadinessCode union (src/features/calculations/readiness.ts:56-82). Any
 * readiness/warning code in a 9.2 fixture MUST be a member (Task 2.3 / R-903). The FICTIONAL
 * `REQUIRES_SIGN_OFF` / `DEDUCTION_ESTIMATE_UNAPPROVED` codes are DELIBERATELY EXCLUDED — 9.2 must
 * NOT propagate them into `lovable/**` (aligning the existing mis-pinned snapshot fixture is 9.3).
 * Kept here as the assertion authority; the GREEN dev may instead import the real union directly.
 */
export const REAL_READINESS_CODES = [
  "MISSING_CUSTOMER",
  "TOTAL_UNCOMPUTABLE",
  "LOW_MARGIN",
  "MISSING_FACILITY",
  "MISSING_CONTACT",
  "EMPTY_SECTION",
  "ZERO_PRICE_ROW",
  "MISSING_WORK_ROLE",
  "UNRESOLVED_VAT",
  "TAX_SIGN_OFF_REQUIRED",
  "HIDDEN_ROWS_INCLUDED",
  "REQUIRED_FILES_DEFERRED",
] as const;

/** The fictional codes 9.2 must NOT seed into lovable/** (the R-903 representativeness trap). */
export const FICTIONAL_READINESS_CODES = ["REQUIRES_SIGN_OFF", "DEDUCTION_ESTIMATE_UNAPPROVED"] as const;

/**
 * The business categories AC1 names — every one MUST be represented by at least one fixture whose
 * SHAPE the later 9.3 comparison depends on. A structured per-category shape match, NOT a raw
 * substring token (do NOT regress the money-pack `raw.includes(token)` weakness — R-921).
 */
export const AC1_CATEGORIES = [
  "crm",
  "settings-pricing",
  "calculations",
  "quotes",
  "pdfs",
  "acceptance",
  "files",
  "accepted-quote-to-job",
] as const;
