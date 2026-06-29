/**
 * G-8a (epic-2 hardening) — exact-empty `search_path` assertion for SECURITY
 * DEFINER functions.
 *
 * The three SECURITY DEFINER functions (`is_active_tenant_member`,
 * `is_tenant_admin`, `record_audit_event`) MUST pin `set search_path = ''` (the
 * empty path) so that every reference inside them is schema-qualified and a
 * tampered session `search_path` cannot hijack resolution (R-006). The behavioral
 * hijack negatives prove the runtime effect; THIS helper hardens the introspection
 * assertion so a non-empty `search_path` (e.g. a regression to `pg_catalog`, or a
 * schema-qualified path AC4 does NOT permit) FAILS LOUDLY instead of slipping past
 * a loose regex.
 *
 * `pg_proc.proconfig` is a `text[]` of `GUC=value` entries (one is `search_path=…`).
 * Postgres serializes the empty path as `search_path=` or `search_path=""`. We
 * locate the ACTUAL `search_path` entry and assert its value is exactly empty —
 * any non-empty value is a failure.
 *
 * TEST-ONLY: imported by the DB-backed INT/RLS suites.
 */
import { expect } from "vitest";

/**
 * Extract the value of the `search_path` GUC from a `pg_proc.proconfig` array.
 * Returns `null` when no `search_path` entry is present at all (the function does
 * NOT pin a search_path — itself a failure for a SECURITY DEFINER fn).
 */
export function extractSearchPathValue(
  proconfig: readonly string[] | null,
): string | null {
  for (const entry of proconfig ?? []) {
    const eq = entry.indexOf("=");
    if (eq === -1) continue;
    const key = entry.slice(0, eq);
    if (key === "search_path") return entry.slice(eq + 1);
  }
  return null;
}

/**
 * Assert that `proconfig` pins `search_path` to EXACTLY empty. A missing entry, or
 * any non-empty value (`pg_catalog`, `public`, a schema-qualified list, …) FAILS.
 *
 * @param fnName  the function name, surfaced in the assertion message.
 * @param proconfig  the raw `pg_proc.proconfig` array for that function.
 */
export function assertSearchPathExactlyEmpty(
  fnName: string,
  proconfig: readonly string[] | null,
): void {
  const value = extractSearchPathValue(proconfig);
  expect(
    value,
    `${fnName}: expected a pinned \`search_path\` proconfig entry (SECURITY DEFINER ` +
      `must set search_path = '') but found none; proconfig=${JSON.stringify(proconfig)}`,
  ).not.toBeNull();
  // Postgres renders the empty path as `` or `""`. Anything else is a non-empty
  // path and MUST fail — this is the exact-empty hardening (G-8a).
  const normalized = value === '""' ? "" : value;
  expect(
    normalized,
    `${fnName}: \`search_path\` must be EXACTLY empty (search_path='') but is ` +
      `${JSON.stringify(value)} — a non-empty path defeats the R-006 schema-` +
      `qualification hardening and must fail.`,
  ).toBe("");
}
