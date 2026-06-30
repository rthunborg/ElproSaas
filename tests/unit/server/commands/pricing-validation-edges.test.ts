/**
 * Story 3.4 — supplementary branch tests for the pricing validators
 * (`@/server/commands/pricing/validation`), covering branches the primary suite
 * (`pricing-validation.test.ts`) does not pin: the UPDATE-path (id present) no-supplier
 * field stripping, the present-but-OVER-LENGTH optional sku/unit rejection, the
 * over-length name/display_name rejection, the non-UUID id rejection on the upsert
 * parsers, and the optional-field-absent path. Runs under `node --test` (pure, no I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateUpsertArticle,
  validateUpsertWorkRole,
} from "@/server/commands/pricing/validation";

const UUID = "33333333-3333-4333-8333-333333333333";

function assertRejected(result: { ok: boolean }, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

// ── article UPDATE path (id present) — supplier stripping still holds ─────────────

test("article UPDATE: a valid id-bearing update carries the id and strips every supplier-ish key", () => {
  const r = validateUpsertArticle({
    id: UUID,
    name: "Kabel 3G1.5",
    unit_price_ore: 1250,
    supplier_id: "SUP-1",
    vendor: "Ahlsell",
    sync_token: "abc",
    fortnox_article_id: "F-1",
    api_key: "secret",
    external_ref: "EXT-1",
    import_batch: "B-1",
    edi_code: "E-1",
    supplier_mapping: { x: 1 },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.id, UUID);
    for (const forbidden of [
      "supplier_id",
      "vendor",
      "sync_token",
      "fortnox_article_id",
      "api_key",
      "external_ref",
      "import_batch",
      "edi_code",
      "supplier_mapping",
    ]) {
      assert.equal(forbidden in r.data, false, `${forbidden} must be stripped on the update path too`);
    }
  }
});

test("article: a non-UUID id is rejected (the parser guards the id shape, not just the server DB)", () => {
  assertRejected(
    validateUpsertArticle({ id: "not-a-uuid", name: "Kabel", unit_price_ore: 1250 }),
    "non-uuid id",
  );
});

test("article: a PRESENT but over-length sku/unit is rejected (optional-but-bad fails)", () => {
  const tooLong = "x".repeat(257);
  assertRejected(
    validateUpsertArticle({ name: "Kabel", sku: tooLong, unit_price_ore: 1250 }),
    "over-length sku",
  );
  assertRejected(
    validateUpsertArticle({ name: "Kabel", unit: tooLong, unit_price_ore: 1250 }),
    "over-length unit",
  );
});

test("article: an over-length name is rejected (bounded text)", () => {
  assertRejected(
    validateUpsertArticle({ name: "x".repeat(257), unit_price_ore: 1250 }),
    "over-length name",
  );
});

test("article: optional sku/unit ABSENT is accepted and they are not present on the validated shape", () => {
  const r = validateUpsertArticle({ name: "Kabel", unit_price_ore: 1250 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal("sku" in r.data, false);
    assert.equal("unit" in r.data, false);
  }
});

// ── work_role UPDATE path (id present) — tenant_id / extras stripped ──────────────

test("workRole UPDATE: a valid id-bearing update carries the id and strips tenant_id / extras", () => {
  const r = validateUpsertWorkRole({
    id: UUID,
    display_name: "Montör",
    cost_rate_ore: 45000,
    sell_rate_ore: 85000,
    tenant_id: "99999999-9999-4999-8999-999999999999",
    is_active: false,
    archived_at: "2026-06-30T00:00:00.000Z",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.id, UUID);
    assert.equal("tenant_id" in r.data, false);
    assert.equal("is_active" in r.data, false);
    assert.equal("archived_at" in r.data, false);
    // Only the validated fields survive.
    assert.deepEqual(
      Object.keys(r.data).sort(),
      ["cost_rate_ore", "display_name", "id", "sell_rate_ore"],
    );
  }
});

test("workRole: a non-UUID id is rejected", () => {
  assertRejected(
    validateUpsertWorkRole({
      id: "not-a-uuid",
      display_name: "Montör",
      cost_rate_ore: 45000,
      sell_rate_ore: 85000,
    }),
    "non-uuid id",
  );
});

test("workRole: an over-length display_name is rejected (bounded text)", () => {
  assertRejected(
    validateUpsertWorkRole({
      display_name: "x".repeat(257),
      cost_rate_ore: 45000,
      sell_rate_ore: 85000,
    }),
    "over-length display_name",
  );
});

test("workRole: a zero-öre rate is accepted (0 is a legitimate non-negative price)", () => {
  const r = validateUpsertWorkRole({
    display_name: "Montör",
    cost_rate_ore: 0,
    sell_rate_ore: 0,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.cost_rate_ore, 0);
    assert.equal(r.data.sell_rate_ore, 0);
  }
});

test("workRole: the display_name is trimmed on the validated value (echoed input is the raw form)", () => {
  const r = validateUpsertWorkRole({
    display_name: "  Montör  ",
    cost_rate_ore: 45000,
    sell_rate_ore: 85000,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.display_name, "Montör");
});
