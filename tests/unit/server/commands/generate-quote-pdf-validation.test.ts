/**
 * Story 6.3 — PURE input-validator coverage for `validateGenerateQuotePdf`
 * (AC1/AC3; test-design-epic-6.md #6.3-INT-01/02, R-606/R-611).
 *
 * `validateGenerateQuotePdf` is the input-shape guard the command envelope runs BEFORE any DB
 * access (architecture §5 step 4) for the Story 6.3 generate-PDF path. It is pure (no I/O), so
 * the fast `node --test` gate can protect its branches WITHOUT a database. The DB-backed INT
 * suites prove the load-bearing source-of-truth / storage-privacy / cross-tenant behaviour; THIS
 * suite proves the exhaustive shape rules cheaply — closing the one remaining validator gap (its
 * 6.1 sibling `validateCreateQuoteVersionFromCalculation` and its 6.2 sibling
 * `validateUpdateDraftQuoteVersion` each already have a unit belt; every command domain does).
 *
 * The load-bearing rules (kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` is REQUIRED and UUID-shaped (a value the DB would reject as `22P02`
 *     fails as VALIDATION, not as an opaque server error);
 *   - the UUID guard is case-INSENSITIVE (an uppercase uuid is accepted);
 *   - the caller supplies ONLY the target version id — `tenant_id` is NEVER read (the resolved
 *     tenant from membership is the sole authority), and any smuggled key must NOT appear on the
 *     validated data (the full snapshot content is read SERVER-side from the frozen rows, never
 *     trusted from the client — a PDF built from client data would defeat the copy-by-value freeze);
 *   - a foreign/non-existent-but-well-shaped id is NOT this validator's job — the envelope
 *     ownership gate maps it to `TENANT_ACCESS_DENIED` before execute (so a shape-valid id passes here).
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII, NO clock.
 * Mirrors `tests/unit/server/commands/update-draft-quote-validation.test.ts`.
 *
 * [Source: story 6.3 Task 4.1 + Task 6.1; src/server/commands/quotes/validation.ts
 *  (validateGenerateQuotePdf); test-design-epic-6.md#6.3-INT-01/02, R-606/R-611;
 *  tests/unit/server/commands/update-draft-quote-validation.test.ts (the sibling precedent)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGenerateQuotePdf } from "@/server/commands/quotes/validation";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

test("[6.3] accepts a well-shaped quote_version_id (the only required field)", () => {
  const r = validateGenerateQuotePdf({ quote_version_id: UUID_A });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.quote_version_id, UUID_A);
  // ONLY the version id is carried — nothing else is ever read (the snapshot is resolved server-side).
  assert.deepEqual(Object.keys(r.data), ["quote_version_id"]);
});

test("[6.3] accepts an UPPERCASE (case-insensitive) uuid quote_version_id", () => {
  const r = validateGenerateQuotePdf({ quote_version_id: UUID_UPPER });
  assert.equal(r.ok, true, "UUID_RE is case-insensitive");
});

test("[6.3] a client-supplied tenant_id / snapshot content is STRIPPED (server resolves the snapshot)", () => {
  const r = validateGenerateQuotePdf({
    quote_version_id: UUID_A,
    // Smuggled fields a hostile caller might attach — the validator must ignore ALL of them so a
    // PDF can NEVER be built from client-supplied data (R-606 copy-by-value freeze).
    tenant_id: "99999999-9999-9999-9999-999999999999",
    base_total_ore: 100000,
    vat_total_ore: 25000,
    lines: [{ label: "evil", unit_cost_ore: 1 }],
    company_name: "Injected Co",
    pdf_status: "generated",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.data), ["quote_version_id"]);
  const asRecord = r.data as unknown as Record<string, unknown>;
  for (const smuggled of ["tenant_id", "base_total_ore", "vat_total_ore", "lines", "company_name", "pdf_status"]) {
    assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
  }
});

// ── [VALIDATION_FAILED] negative paths ──────────────────────────────────────────────────────

test("[6.3 VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
  for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
    const r = validateGenerateQuotePdf(raw);
    assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});

test("[6.3 VALIDATION_FAILED] a missing / non-uuid quote_version_id is rejected", () => {
  const bad = [
    {},
    { quote_version_id: null },
    { quote_version_id: 123 },
    { quote_version_id: "not-a-uuid" },
    { quote_version_id: "1111" },
    { quote_version_id: `${UUID_A}-extra` }, // over the 36-char / shape guard
    { quote_version_id: "" },
    { quote_version_id: "11111111-1111-1111-1111-11111111111g" }, // a non-hex char
  ];
  for (const raw of bad) {
    const r = validateGenerateQuotePdf(raw);
    assert.equal(r.ok, false, `quote_version_id ${JSON.stringify(raw)} must fail`);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION_FAILED");
  }
});
