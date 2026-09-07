/**
 * Story 10.4 — ATDD RED-PHASE scaffold: the PRECEDENT-SETTING entitlement descriptor contract
 * (10.4-UNIT-01, P0, AC1; test-design-epic-10.md R-1040). This is the phase-defining spec — a wrong
 * `{ data, entitlements }` shape here propagates to EVERY later Phase B read-model, so the descriptor
 * is pinned as a pure `node --test` UNIT with no DB and no stack.
 *
 * The pure projection under test (Task 2.1/2.2): `projectWithEntitlements(fullAggregate, entitlementInput)`
 * → `{ data, entitlements: { withheld } }`. The load-bearing contract (architecture-phase-b §11 / AR-B6):
 *   - a WITHHELD money field is ABSENT from `data` (deleted — never `null`, never `0`) AND its stable
 *     `FieldPath` string is listed in `entitlements.withheld` (the "absent + listed" rule);
 *   - AGGREGATE HONESTY: any aggregate whose components include a withheld leaf is ITSELF withheld
 *     (absent + listed) — the server never ships a partial sum;
 *   - COLUMN OMISSION: a wholly-withheld field is omitted, not per-cell masked (the UI never consults
 *     role names client-side — absent+listed means mask/omit, absent+not-listed means genuinely empty);
 *   - counts + hit rate are NEVER money and are ALWAYS present (never withheld);
 *   - the CONSERVATIVE single-role default resolves `tenant_admin ⇒ money-entitled ⇒ withheld: []`
 *     (the N-4 per-role matrix is OWNER-GATED / Epic 11 — 10.4 ships the MECHANISM, proven by driving
 *     an UNENTITLED input, not the confirmed matrix).
 *
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * `src/server/read-models/entitlements.ts` is landed; the suite imports the REAL projection and is
 * unskipped. Every assertion encodes the descriptor CONTRACT (no `assert.ok(true)`); it is designed to
 * FAIL against a wrong/absent projection.
 *
 * Runner: `node --test` (`pnpm run test:unit`) — pure, NO DB, NO PII. Two-runner discipline
 * (epic-10 retro 10-1 Phase-4): pure descriptor logic lives on the fast gate, never Playwright.
 *
 * [Source: story 10.4 AC1 + Tasks 2.1/2.2 + SETTLED DESIGN DECISIONS 2/3; architecture-phase-b §11
 *  (`server/read-models`, `{ data, entitlements.withheld }`, absent+listed, aggregate honesty, column
 *  omission) / §3.6 / §3.1 ADR-B001; test-design-epic-10.md#10.4-UNIT-01, R-1040/R-1046]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { projectWithEntitlements } from "@/server/read-models/entitlements";
import type { PipelineAggregate } from "@/server/read-models/quote-pipeline-aggregate";

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────
const FULL_AGGREGATE: PipelineAggregate = {
  period: { from: "2026-07-01", to: "2026-07-31" },
  sentCount: 9,
  acceptedCount: 4,
  lostCount: 2,
  hitRate: 4 / 6,
  openFollowUpCount: 3,
  overdueFollowUpCount: 1,
  acceptedValueOre: 12_500_00,
};

// ── 10.4-UNIT-01: the descriptor contract ────────────────────────────────────────────────────────

test(
  "10.4-UNIT-01: UNENTITLED input — acceptedValueOre is ABSENT from data (not null, not 0) AND listed in withheld",
  () => {
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, {
      moneyEntitled: false,
    });
    // ABSENT, not masked: the key must not exist on `data` at all.
    assert.equal(
      Object.prototype.hasOwnProperty.call(data, "acceptedValueOre"),
      false,
      "withheld money field must be ABSENT from data (deleted), never present-as-null/0",
    );
    assert.equal(data.acceptedValueOre, undefined);
    // LISTED: its stable FieldPath string is in withheld.
    assert.ok(
      entitlements.withheld.includes("acceptedValueOre"),
      "withheld money field must be listed in entitlements.withheld",
    );
  },
);

test(
  "10.4-UNIT-01: UNENTITLED input — the withheld field is NEVER shipped as null or 0 (the R-1040 failure mode)",
  () => {
    const { data } = projectWithEntitlements(FULL_AGGREGATE, { moneyEntitled: false });
    // Explicitly reject the two dishonest-present shapes the precedent must never take.
    assert.notEqual(data.acceptedValueOre, null);
    assert.notEqual(data.acceptedValueOre, 0);
  },
);

test(
  "10.4-UNIT-01: conservative single-role default — tenant_admin ⇒ money-entitled ⇒ withheld is [] and the amount is PRESENT",
  () => {
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, {
      roles: ["tenant_admin"],
    });
    assert.deepEqual([...entitlements.withheld], []);
    assert.equal(data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
  },
);

test(
  "10.4-UNIT-01: an OMITTED entitlement input is FAIL-CLOSED (unentitled — money absent + listed), same as an empty role set",
  () => {
    // Hardened by the 10.4 integration review (defense-in-depth, R-1040): the LEAST-known caller (no
    // input at all) must be the MOST guarded, not the most permissive — an omitted input resolves the
    // SAME as an explicit empty role set (unentitled). Callers that ARE entitled (the B1a all-
    // tenant_admin reality) pass an EXPLICIT EntitlementInput; the read-model never relies on the
    // omitted-input default to expose money.
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE);
    assert.equal(
      Object.prototype.hasOwnProperty.call(data, "acceptedValueOre"),
      false,
      "an omitted input must withhold the money leaf (fail-closed), never expose it",
    );
    assert.deepEqual([...entitlements.withheld], ["acceptedValueOre"]);
  },
);

test(
  "10.4-UNIT-01: counts + hit rate are NEVER withheld — present and unchanged for an unentitled input",
  () => {
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, {
      moneyEntitled: false,
    });
    // Non-money fields survive the projection untouched regardless of entitlement.
    assert.equal(data.sentCount, FULL_AGGREGATE.sentCount);
    assert.equal(data.acceptedCount, FULL_AGGREGATE.acceptedCount);
    assert.equal(data.lostCount, FULL_AGGREGATE.lostCount);
    assert.equal(data.hitRate, FULL_AGGREGATE.hitRate);
    assert.equal(data.openFollowUpCount, FULL_AGGREGATE.openFollowUpCount);
    assert.equal(data.overdueFollowUpCount, FULL_AGGREGATE.overdueFollowUpCount);
    // And none of them appears in withheld — only the money field can be withheld.
    for (const f of ["sentCount", "acceptedCount", "lostCount", "hitRate", "openFollowUpCount", "overdueFollowUpCount"]) {
      assert.equal(entitlements.withheld.includes(f), false, `${f} must never be withheld`);
    }
  },
);

test(
  "10.4-UNIT-01: aggregate honesty — a money aggregate with a withheld component is ITSELF withheld (absent + listed), never a partial sum",
  () => {
    // For 10.4 the money aggregate (acceptedValueOre) is a single leaf, but the projection must bake
    // the rule in: when the money leaf is withheld, the aggregate is absent + listed — the server
    // never ships a partial/zeroed sum a caller could mistake for a real total.
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, {
      moneyEntitled: false,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(data, "acceptedValueOre"), false);
    assert.ok(entitlements.withheld.includes("acceptedValueOre"));
    // Not a partial sum masquerading as present.
    assert.equal("acceptedValueOre" in data, false);
  },
);

test(
  "10.4-UNIT-01: withheld is a STABLE FieldPath string list (column omission, not per-cell masking)",
  () => {
    const { entitlements } = projectWithEntitlements(FULL_AGGREGATE, { moneyEntitled: false });
    // The listing is FieldPath strings the UI resolves to omit-a-column — never role names, never
    // a masking sentinel value.
    for (const path of entitlements.withheld) {
      assert.equal(typeof path, "string");
      assert.ok(path.length > 0);
    }
    // The only withheld-eligible field in this precedent aggregate is the money one.
    assert.deepEqual([...entitlements.withheld], ["acceptedValueOre"]);
  },
);

// ── 10.4-UNIT-01 (expanded — the resolver seam that Epic 11's matrix retrofits) ─────────────────────
// The originals prove the descriptor mechanism via the explicit `moneyEntitled` flag; these pin the
// ROLE-SET resolution path (the seam 11.2 feeds the real matrix) + the explicit-flag precedence + the
// projection's purity, so a wrong resolver default or an in-place mutation can never ship silently.

test(
  "10.4-UNIT-01: a role set WITHOUT tenant_admin is unentitled — the money field is withheld (the mechanism via the role path)",
  () => {
    // Under B1a everyone is tenant_admin, but the withholding path MUST work off a role set too so
    // Epic 11's per-role matrix retrofits the SAME seam. A non-admin role ⇒ money absent + listed.
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, { roles: ["saljare"] });
    assert.equal(Object.prototype.hasOwnProperty.call(data, "acceptedValueOre"), false);
    assert.deepEqual([...entitlements.withheld], ["acceptedValueOre"]);
  },
);

test(
  "11.1: every matrix-authorized money role receives the projected field without a withheld marker",
  () => {
    for (const role of ["projektledare", "ekonomi"]) {
      const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, { roles: [role] });
      assert.equal(data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
      assert.deepEqual([...entitlements.withheld], []);
    }
  },
);

test(
  "10.4-UNIT-01: an EMPTY role set is unentitled (conservative — no role grants money ⇒ withheld)",
  () => {
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, { roles: [] });
    assert.equal("acceptedValueOre" in data, false);
    assert.ok(entitlements.withheld.includes("acceptedValueOre"));
  },
);

test(
  "10.4-UNIT-01: an explicit moneyEntitled flag OVERRIDES the role set (precedence, both directions)",
  () => {
    // Explicit `moneyEntitled: true` entitles a non-admin role set...
    const entitled = projectWithEntitlements(FULL_AGGREGATE, { roles: ["saljare"], moneyEntitled: true });
    assert.equal(entitled.data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
    assert.deepEqual([...entitled.entitlements.withheld], []);
    // ...and explicit `moneyEntitled: false` withholds even from tenant_admin (the flag wins).
    const withheld = projectWithEntitlements(FULL_AGGREGATE, { roles: ["tenant_admin"], moneyEntitled: false });
    assert.equal("acceptedValueOre" in withheld.data, false);
    assert.deepEqual([...withheld.entitlements.withheld], ["acceptedValueOre"]);
  },
);

test(
  "10.4-UNIT-01: projectWithEntitlements does NOT mutate the input aggregate (pure — the source survives withholding)",
  () => {
    // Withholding deletes from a COPY, never the caller's aggregate — the same `full` can be re-projected
    // for another role in the same request without the money leaf having vanished from the source.
    const source: PipelineAggregate = { ...FULL_AGGREGATE };
    projectWithEntitlements(source, { moneyEntitled: false });
    assert.equal(source.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre, "input aggregate is untouched");
    // Re-projecting the SAME source for an entitled caller still yields the money field.
    const second = projectWithEntitlements(source, { moneyEntitled: true });
    assert.equal(second.data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
  },
);
