/**
 * Story 3.4 — ATDD RED-PHASE scaffold: PURE-LOGIC tests for the pricing input
 * validators (`@/server/commands/pricing/validation`). Pin the load-bearing
 * INTEGER-ÖRE money discipline + the no-supplier-scope validated-shape contract
 * WITHOUT a database (the DB-backed envelope tests drive a handful through Vitest;
 * this exhaustively pins the pure validators). Runs under `node --test`.
 *
 * 🔴 RED PHASE — `@/server/commands/pricing/validation` does NOT exist yet (Story 3.4
 * dev Task 2.1). Until it lands these imports do not resolve and `node --test` would
 * fail to load the file, so EVERY test below is registered through a local
 * `describePending(...)` gate that SKIPS the whole file when the module is absent —
 * keeping the green `test:unit` baseline UNPERTURBED. The dev phase removes the gate
 * (replace `describePending` with a direct `import` + plain `test`); the assertions
 * are the CONTRACT — do not weaken them.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - INTEGER-ÖRE money (P0, AC2): `isOreAmount(v)` accepts ONLY a non-negative SAFE
 *     integer (Number.isInteger, >= 0, <= the safe overflow bound) and REJECTS floats,
 *     negatives, NaN/Infinity, locale-comma strings ("850,00"), decimal strings
 *     ("850.00"), non-numeric strings, and overflow. cost_rate_ore / sell_rate_ore
 *     (work roles) + unit_price_ore (articles) all flow through it → VALIDATION_FAILED
 *     on each bad shape. NO VAT/ROT/total calculation is exercised (Epic 4 owns it).
 *   - HARD no-supplier-scope (P0, AC3): the article validator's OUTPUT type carries
 *     ONLY the minimal manual columns — any client-supplied supplier-ish key
 *     (supplier_id / sync / fortnox / api_key / external_ref / vendor / import / edi /
 *     mapping) is simply NOT in the validated shape (stripped), mirroring the CRM
 *     tenant_id-stripping discipline.
 *   - Collection (NOT singleton): the validators carry an OPTIONAL `id` (present →
 *     UPDATE, absent → CREATE) — there is no one-row-per-tenant assumption; client
 *     tenant_id is NEVER part of the validated value.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ── Red-phase module gate ────────────────────────────────────────────────────────
// The pricing validation module is authored in the DEV phase. Until it exists we
// cannot statically `import` it (node --test would crash on an unresolved module), so
// load it dynamically and register the suite ONLY when present. In the GREEN phase,
// delete this gate and switch to a top-level `import { ... } from
// "@/server/commands/pricing/validation"` + plain `test(...)` registrations.
type PricingValidation = {
  isOreAmount: (v: unknown) => boolean;
  validateUpsertWorkRole: (input: unknown) => ValidationResult;
  validateUpsertArticle: (input: unknown) => ValidationResult;
  validateArchive: (input: unknown) => ValidationResult;
};
type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string };

let mod: PricingValidation | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require("@/server/commands/pricing/validation") as PricingValidation;
} catch {
  mod = null;
}

/** Register `body` only when the pricing module exists; otherwise skip (red phase). */
function pending(name: string, body: (m: PricingValidation) => void): void {
  if (!mod) {
    test(name, { skip: "RED PHASE: pricing validation module not implemented yet" }, () => {});
    return;
  }
  const m = mod;
  test(name, () => body(m));
}

function assertRejected(result: ValidationResult, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

// ── isOreAmount — the load-bearing integer-öre money guard ───────────────────────

pending("isOreAmount: a valid non-negative integer öre is accepted (0 and a realistic rate)", (m) => {
  assert.equal(m.isOreAmount(0), true); // 0 kr/tim is a legitimate value
  assert.equal(m.isOreAmount(85000), true); // 850,00 kr/tim
  assert.equal(m.isOreAmount(1), true); // 1 öre
});

pending("isOreAmount: a FLOAT öre value is rejected (öre are whole integers, never fractional)", (m) => {
  assert.equal(m.isOreAmount(850.5), false);
  assert.equal(m.isOreAmount(85000.01), false);
  assert.equal(m.isOreAmount(0.5), false);
});

pending("isOreAmount: a NEGATIVE öre value is rejected (prices are non-negative)", (m) => {
  assert.equal(m.isOreAmount(-1), false);
  assert.equal(m.isOreAmount(-85000), false);
});

pending("isOreAmount: NaN / Infinity / -Infinity are rejected (non-finite is never a price)", (m) => {
  assert.equal(m.isOreAmount(Number.NaN), false);
  assert.equal(m.isOreAmount(Number.POSITIVE_INFINITY), false);
  assert.equal(m.isOreAmount(Number.NEGATIVE_INFINITY), false);
});

pending("isOreAmount: a LOCALE-COMMA string ('850,00') is rejected (the comma-decimal trap)", (m) => {
  // The Swedish-comma input is a UI concern converted at the boundary; the COMMAND
  // authority sees integer öre only. A raw "850,00" reaching the validator is a bug
  // and must be rejected — never silently coerced to 85000 (or NaN).
  assert.equal(m.isOreAmount("850,00" as unknown), false);
  assert.equal(m.isOreAmount("1 250,50" as unknown), false);
});

pending("isOreAmount: a plain DECIMAL string ('850.00') and any numeric string is rejected (no string coercion)", (m) => {
  assert.equal(m.isOreAmount("850.00" as unknown), false);
  assert.equal(m.isOreAmount("85000" as unknown), false); // even a clean int-string: the authority takes a NUMBER
});

pending("isOreAmount: a non-numeric string / null / undefined / object is rejected", (m) => {
  assert.equal(m.isOreAmount("abc" as unknown), false);
  assert.equal(m.isOreAmount(null), false);
  assert.equal(m.isOreAmount(undefined), false);
  assert.equal(m.isOreAmount({} as unknown), false);
});

pending("isOreAmount: an OVERFLOW value beyond the safe bound is rejected (fits bigint + a realistic price ceiling)", (m) => {
  // Beyond Number.MAX_SAFE_INTEGER integer arithmetic is unreliable; an absurd price is
  // also a typo/attack. Either way it must be rejected (the column is bigint, but the
  // command guards the JS-side bound before the DB CHECK does belt-and-braces).
  assert.equal(m.isOreAmount(Number.MAX_SAFE_INTEGER + 1), false);
  assert.equal(m.isOreAmount(2 ** 63), false); // past bigint range entirely
});

pending("isOreAmount: the safe upper bound is INCLUSIVE (the agreed ceiling is accepted, one past it is not)", (m) => {
  // The exact ceiling is the dev's documented bound (<= MAX_SAFE_INTEGER or a tighter
  // realistic cap). Whatever it is, it must be inclusive and its +1 rejected — pin the
  // boundary symmetry without hard-coding the magnitude.
  assert.equal(m.isOreAmount(Number.MAX_SAFE_INTEGER), true);
});

// ── validateUpsertWorkRole — display_name + cost/sell öre rates ──────────────────

pending("workRole: a valid create (no id) with non-negative integer öre rates is accepted", (m) => {
  const r = m.validateUpsertWorkRole({
    display_name: "Montör",
    cost_rate_ore: 45000,
    sell_rate_ore: 85000,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.cost_rate_ore, 45000);
    assert.equal(r.data.sell_rate_ore, 85000);
    assert.equal("id" in r.data, false); // create has no id
  }
});

pending("workRole: an UPDATE carries a UUID-shaped id alongside the validated fields", (m) => {
  const r = m.validateUpsertWorkRole({
    id: "11111111-1111-4111-8111-111111111111",
    display_name: "Montör",
    cost_rate_ore: 45000,
    sell_rate_ore: 85000,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.id, "11111111-1111-4111-8111-111111111111");
});

pending("workRole: a FLOAT / NEGATIVE / locale-comma cost_rate_ore is rejected → VALIDATION_FAILED", (m) => {
  for (const bad of [850.5, -1, "850,00", "850.00", Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assertRejected(
      m.validateUpsertWorkRole({
        display_name: "Montör",
        cost_rate_ore: bad as unknown,
        sell_rate_ore: 85000,
      }),
      `cost_rate_ore=${String(bad)}`,
    );
  }
});

pending("workRole: a FLOAT / NEGATIVE / overflow sell_rate_ore is rejected → VALIDATION_FAILED", (m) => {
  for (const bad of [99.99, -50, Number.POSITIVE_INFINITY, 2 ** 63]) {
    assertRejected(
      m.validateUpsertWorkRole({
        display_name: "Montör",
        cost_rate_ore: 45000,
        sell_rate_ore: bad as unknown,
      }),
      `sell_rate_ore=${String(bad)}`,
    );
  }
});

pending("workRole: a missing / blank / whitespace-only display_name is rejected (trim before the empty check)", (m) => {
  assertRejected(
    m.validateUpsertWorkRole({ cost_rate_ore: 45000, sell_rate_ore: 85000 }),
    "missing display_name",
  );
  assertRejected(
    m.validateUpsertWorkRole({ display_name: "", cost_rate_ore: 45000, sell_rate_ore: 85000 }),
    "empty display_name",
  );
  assertRejected(
    m.validateUpsertWorkRole({ display_name: "   ", cost_rate_ore: 45000, sell_rate_ore: 85000 }),
    "whitespace display_name",
  );
});

pending("workRole: a missing rate is rejected (both rates are required money fields)", (m) => {
  assertRejected(
    m.validateUpsertWorkRole({ display_name: "Montör", sell_rate_ore: 85000 }),
    "missing cost_rate_ore",
  );
  assertRejected(
    m.validateUpsertWorkRole({ display_name: "Montör", cost_rate_ore: 45000 }),
    "missing sell_rate_ore",
  );
});

pending("workRole: a client-supplied tenant_id is NEVER part of the validated value (stripped)", (m) => {
  const r = m.validateUpsertWorkRole({
    tenant_id: "99999999-9999-4999-8999-999999999999",
    display_name: "Montör",
    cost_rate_ore: 45000,
    sell_rate_ore: 85000,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("tenant_id" in r.data, false);
});

pending("workRole: a non-record input is rejected", (m) => {
  assertRejected(m.validateUpsertWorkRole(null), "null");
  assertRejected(m.validateUpsertWorkRole("x"), "string");
});

// ── validateUpsertArticle — name + optional sku/unit + unit_price_ore ────────────

pending("article: a valid minimal create (name + integer-öre unit price) is accepted", (m) => {
  const r = m.validateUpsertArticle({ name: "Kabel 3G1.5", unit_price_ore: 1250 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.unit_price_ore, 1250);
});

pending("article: optional sku/unit survive onto the validated value when present", (m) => {
  const r = m.validateUpsertArticle({
    name: "Kabel 3G1.5",
    sku: "K-3G15",
    unit: "m",
    unit_price_ore: 1250,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.sku, "K-3G15");
    assert.equal(r.data.unit, "m");
  }
});

pending("article: a FLOAT / NEGATIVE / locale-comma / overflow unit_price_ore is rejected → VALIDATION_FAILED", (m) => {
  for (const bad of [12.5, -1, "12,50", "12.50", Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assertRejected(
      m.validateUpsertArticle({ name: "Kabel", unit_price_ore: bad as unknown }),
      `unit_price_ore=${String(bad)}`,
    );
  }
});

pending("article: a missing / blank name is rejected", (m) => {
  assertRejected(m.validateUpsertArticle({ unit_price_ore: 1250 }), "missing name");
  assertRejected(m.validateUpsertArticle({ name: "   ", unit_price_ore: 1250 }), "blank name");
});

pending("article: HARD no-supplier-scope — NO supplier-ish key survives onto the validated shape (stripped)", (m) => {
  // The validated OUTPUT must carry ONLY the minimal manual columns. Any client-supplied
  // supplier/sync/integration field is simply not in the shape — the command can never
  // write it (mirrors the CRM no-supplier-scope discipline + the tenant_id strip).
  const r = m.validateUpsertArticle({
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
      assert.equal(forbidden in r.data, false, `${forbidden} must be stripped from the validated shape`);
    }
    // The minimal manual columns DO survive.
    assert.equal(r.data.name, "Kabel 3G1.5");
    assert.equal(r.data.unit_price_ore, 1250);
  }
});

pending("article: a client-supplied tenant_id is NEVER part of the validated value (stripped)", (m) => {
  const r = m.validateUpsertArticle({
    tenant_id: "99999999-9999-4999-8999-999999999999",
    name: "Kabel",
    unit_price_ore: 1250,
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("tenant_id" in r.data, false);
});

// ── validateArchive — id-only guard (work roles + articles share the shape) ──────

pending("archive: a UUID-shaped id is accepted; a bad / missing id is rejected", (m) => {
  const r = m.validateArchive({ id: "11111111-1111-4111-8111-111111111111" });
  assert.equal(r.ok, true);
  assertRejected(m.validateArchive({ id: "not-a-uuid" }), "bad id");
  assertRejected(m.validateArchive({}), "missing id");
  assertRejected(m.validateArchive(null), "null");
});

pending("archive: the validated value carries ONLY the id (no smuggled fields survive)", (m) => {
  const r = m.validateArchive({
    id: "11111111-1111-4111-8111-111111111111",
    is_active: true,
    tenant_id: "99999999-9999-4999-8999-999999999999",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(Object.keys(r.data), ["id"]);
});
