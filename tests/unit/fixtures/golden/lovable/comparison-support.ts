/**
 * Story 9.3 — SHARED comparison-harness support (RED-PHASE SCAFFOLD).
 *
 * Extends the 9.2 pack-support (`./lovable-pack-support`) with the pieces the 9.3
 * GOLDEN-MASTER COMPARISON harness needs on top of the 9.2 fixture-schema helpers:
 *   - the REAL exported `ReadinessCode` union imported straight from the product source
 *     (the AUTHORITATIVE representativeness authority — R-903 / 9.3-VALID-01), NOT a
 *     hand-copied list that can drift;
 *   - the nine AC1 COMPARISON categories the coverage MANIFEST enumerates (9.3-CMP-*,
 *     R-904 / R-921) — DISTINCT from the eight 9.2 FIXTURE categories: the manifest keys
 *     on the comparison the harness runs, not on the fixture file that feeds it;
 *   - the widened `documented-delta` / `old-lovable` LABELLING guard shape (R-913):
 *     the divergent old value may be a NUMBER (`oldLovableWouldGive`) OR a
 *     CLASSIFICATION CODE (`oldLovableValue`) — a union, never numeric-only.
 *
 * ── RED-PHASE STATUS ──────────────────────────────────────────────────────────────────
 * This module + the sibling `lovable-comparison-*.test.ts` suites are RED-PHASE
 * scaffolds authored BEFORE the green-phase harness lands. They import the REAL new-side
 * oracle (`@/features/calculations/*`, `@/lib/money`, the quote-PDF view-model + renderer,
 * the accepted-price authority) at the TOP level behind a HARD surface-present assertion
 * (NEVER a `describe.skip` precondition that self-disables — the ledgered
 * `TAX/VAT_SURFACE_PRESENT` weakness, deferred-work.md#epic-4 iter-2). Because those
 * oracle surfaces ALREADY EXIST (Epics 4-8 landed), the suites are authored to RUN, not
 * skip — the RED signal comes from the assertions the dev must satisfy (the coverage
 * manifest failing on a not-yet-driven category; the representativeness validator failing
 * on the still-mis-pinned `snapshots/quote-version-source.json`; the widened LABELLING
 * guard the money-pack does not yet enforce).
 *
 * NO PII IN THIS FILE. It carries loaders + category enums + the real union only.
 *
 * [Source: story 9.3 Tasks 1.1-1.4 / 3.1-3.2; test-design-epic-9.md R-903/R-904/R-906/
 *  R-912/R-913/R-921, 9.3-CMP-01/02/03, 9.3-VALID-01, 9.3-MANIFEST-01, 9.3-DELTA-01;
 *  src/features/calculations/readiness.ts (the REAL ReadinessCode union);
 *  tests/unit/fixtures/golden/lovable/lovable-pack-support.ts (the 9.2 helpers this extends);
 *  tests/unit/features/calculations/calc-golden-pack.test.ts (the pack pattern to mirror)]
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Re-export the 9.2 helpers so the 9.3 suites import a SINGLE support surface.
export {
  GOLDEN_LOVABLE_DIR,
  listLovableFixtureFiles,
  readJson,
  ORIGINS,
  isValidOrigin,
  AC1_CATEGORIES,
  type Origin,
} from "./lovable-pack-support";

// ── The REAL exported ReadinessCode union — the AUTHORITATIVE representativeness authority.
//    Imported at the TOP level from product source (R-903 / 9.3-VALID-01): do NOT hardcode a
//    drifting copy, do NOT trust memory. The 9.2 support carries a snapshot copy
//    (REAL_READINESS_CODES) for the FIXTURE guards; 9.3's representativeness VALIDATOR uses the
//    LIVE union so a new code added in readiness.ts is picked up with no test edit.
//    NOTE: TypeScript's `ReadinessCode` is a pure type — it has NO runtime value. The green dev
//    MUST derive a runtime `Set<string>` of the real members from an EXPORTED runtime source in
//    readiness.ts (a `const READINESS_CODES = [...] as const` array, or an equivalent runtime
//    export). Task 1.2 (green): add that runtime export in readiness.ts IF one does not already
//    exist, then populate `realReadinessCodeSet()` below from it. Until then this returns null and
//    the representativeness validator FAILS LOUD (red phase) rather than silently trusting a copy.
export type { ReadinessCode } from "@/features/calculations/readiness";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The mis-pinned snapshot fixture 9.3 aligns (Task 1.3) — the ONE existing fixture 9.3 mutates. */
export const SNAPSHOT_QUOTE_VERSION_SOURCE = resolve(
  HERE,
  "../../../../fixtures/golden/snapshots/quote-version-source.json",
);

/**
 * The NINE AC1 COMPARISON categories the coverage MANIFEST enumerates (9.3-CMP-*, R-904/R-921).
 * DISTINCT from the eight 9.2 FIXTURE categories (AC1_CATEGORIES) — the manifest keys on the
 * comparison the harness DRIVES through the real oracle, not on the fixture file that feeds it.
 * A comparison category with ZERO executed live-driven cases FAILS the manifest.
 */
export const AC1_COMPARISON_CATEGORIES = [
  "calc-totals",
  "vat-tax-blocks",
  "options-tillval",
  "hidden-rows",
  "quote-visible-lines",
  "pdf-text-visual",
  "attachment-selection",
  "acceptance-transition-and-accepted-price",
  "job-source-refs",
] as const;
export type ComparisonCategory = (typeof AC1_COMPARISON_CATEGORIES)[number];

/**
 * The runtime set of REAL ReadinessCode members (Task 1.2, GREEN). Returns null until the dev
 * wires a RUNTIME export from readiness.ts. The representativeness validator asserts this is
 * non-null (fail-loud, never a silent trust of a memorised copy) and then validates EVERY
 * readiness/warning code in EVERY comparison fixture against it.
 *
 * GREEN: replace the `return null` with an import of the real runtime array from readiness.ts, e.g.
 *   import { READINESS_CODES } from "@/features/calculations/readiness";
 *   return new Set<string>(READINESS_CODES);
 * Do NOT paste a literal list here (that reintroduces the drift the validator exists to prevent).
 */
export function realReadinessCodeSet(): ReadonlySet<string> | null {
  // RED PHASE: intentionally unresolved. The green dev adds a runtime union export in
  // readiness.ts and returns it here. Returning null makes the validator FAIL LOUD.
  return null;
}

/** Load an anonymized 9.2 lovable fixture by category filename (e.g. "calculations"). */
export function loadLovableFixture(category: string): {
  readonly category?: string;
  readonly cases?: readonly Record<string, unknown>[];
  readonly _doc?: string;
} {
  const dir = resolve(HERE, "../../../../fixtures/golden/lovable");
  const path = resolve(dir, `${category}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Whether the aligned snapshot fixture still carries a FICTIONAL ReadinessCode (Task 1.3 gate). */
export function snapshotStillCarriesFictionalCode(): boolean {
  if (!existsSync(SNAPSHOT_QUOTE_VERSION_SOURCE)) return false;
  const raw = readFileSync(SNAPSHOT_QUOTE_VERSION_SOURCE, "utf8");
  return /REQUIRES_SIGN_OFF|DEDUCTION_ESTIMATE_UNAPPROVED/.test(raw);
}

/**
 * The widened LABELLING guard (R-913, 9.3-DELTA-01): a `documented-delta` / `old-lovable` case
 * MUST carry a divergent old value that is a NUMBER (`oldLovableWouldGive`) OR a CLASSIFICATION
 * CODE (`oldLovableValue`) — a union, non-empty. Returns the present divergent value (of either
 * shape) or `undefined` if NEITHER is present (which the LABELLING guard treats as a failure).
 * Do NOT force a classification delta to a bare number; do NOT drop the numeric arm.
 */
export function divergentOldValue(
  c: Record<string, unknown>,
): number | string | undefined {
  const numeric = c["oldLovableWouldGive"];
  if (typeof numeric === "number") return numeric;
  const classification = c["oldLovableValue"];
  if (typeof classification === "string" && classification.trim().length > 0) {
    return classification;
  }
  return undefined;
}
