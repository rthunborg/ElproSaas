/**
 * Story 5.3 — UNIT tests for the PURE pricing-source option mapping
 * (`src/features/calculations/source-options.ts`). Pins the server→client island shape the
 * row editor offers: a work role maps to a labor-source option with its SELL rate as the
 * prefill price; an article maps to a material-source option with its unit price. Runs under
 * `node --test` (the fast gate).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  articleOptions,
  toSourceOptions,
  workRoleOptions,
} from "@/features/calculations/source-options";

const WORK_ROLES = [
  { id: "r1", display_name: "Elektriker", cost_rate_ore: 45000, sell_rate_ore: 85000, is_active: true },
  { id: "r2", display_name: "Montör", cost_rate_ore: 40000, sell_rate_ore: 70000, is_active: true },
];

const ARTICLES = [
  { id: "a1", name: "Kabel 3G1.5", sku: "K-315", unit: "m", unit_price_ore: 1250, is_active: true },
  { id: "a2", name: "Dosa infälld", sku: null, unit: null, unit_price_ore: 3900, is_active: true },
];

test("workRoleOptions maps id/name + the SELL rate as the prefill price (not the cost rate)", () => {
  const opts = workRoleOptions(WORK_ROLES);
  assert.deepEqual(opts, [
    { id: "r1", name: "Elektriker", priceOre: 85000 },
    { id: "r2", name: "Montör", priceOre: 70000 },
  ]);
});

test("articleOptions maps id/name + the unit price as the prefill price", () => {
  const opts = articleOptions(ARTICLES);
  assert.deepEqual(opts, [
    { id: "a1", name: "Kabel 3G1.5", priceOre: 1250 },
    { id: "a2", name: "Dosa infälld", priceOre: 3900 },
  ]);
});

test("toSourceOptions assembles both ACTIVE lists for the editor island", () => {
  const lists = toSourceOptions(WORK_ROLES, ARTICLES);
  assert.equal(lists.workRoles.length, 2);
  assert.equal(lists.articles.length, 2);
  assert.equal(lists.workRoles[0].priceOre, 85000); // sell rate, the row-price prefill
  assert.equal(lists.articles[0].priceOre, 1250);
});

test("empty source lists map to empty option lists (a tenant with no pricing rows)", () => {
  const lists = toSourceOptions([], []);
  assert.deepEqual(lists, { workRoles: [], articles: [] });
});
