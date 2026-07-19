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
 * ── WHY SKIPPED (RED PHASE) ──────────────────────────────────────────────────────────────────────
 * `src/server/read-models/entitlements.ts` does NOT exist yet (Task 2 is the Story 10.4 DEV phase).
 * Until it lands, importing `@/server/read-models/entitlements` would not resolve, so this scaffold:
 *   - declares the intended descriptor surface via LOCAL `notYetImplemented()` placeholders + local
 *     types so the file TYPE-CHECKS today WITHOUT importing a non-existent module (the project's
 *     red-phase idiom — Story 10.3 used the same), and
 *   - keeps every `test(...)` `{ skip: true }` so it cannot fail CI before the feature exists.
 * Every assertion encodes EXPECTED behaviour (no `assert.ok(true)`); the suite is designed to FAIL
 * against a wrong/absent projection.
 *
 * ── GREEN-PHASE HAND-OFF (Story 10.4 dev) ────────────────────────────────────────────────────────
 * After Task 2.1/2.2 land:
 *   1. Delete the LOCAL placeholder block and the local `PipelineData` / `EntitlementInput` /
 *      `PipelineDescriptor` types, replacing them with real imports:
 *        import { projectWithEntitlements } from "@/server/read-models/entitlements";
 *        import type { PipelineAggregate } from "@/server/read-models/quote-pipeline-aggregate";
 *   2. Remove `{ skip: true }` from every test. The assertions are the CONTRACT — do NOT weaken them.
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

// ── LOCAL red-phase declarations (green phase replaces with real imports; see hand-off) ──────────
function notYetImplemented(): never {
  throw new Error(
    "Story 10.4 not yet implemented — remove this placeholder and import projectWithEntitlements " +
      "from @/server/read-models/entitlements in the green phase.",
  );
}

/** The full (pre-entitlement) pipeline aggregate — the projection's input (mirrors Task 1 output). */
interface PipelineAggregate {
  readonly period: { readonly from: string; readonly to: string };
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly lostCount: number;
  readonly hitRate: number | null;
  readonly openFollowUpCount: number;
  readonly overdueFollowUpCount: number;
  readonly acceptedValueOre: number;
}

/** The entitlement-projected data — the money field is OPTIONAL because it is ABSENT when withheld. */
interface PipelineData {
  readonly period: { readonly from: string; readonly to: string };
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly lostCount: number;
  readonly hitRate: number | null;
  readonly openFollowUpCount: number;
  readonly overdueFollowUpCount: number;
  readonly acceptedValueOre?: number;
}

/** The role/entitlement input — a role set OR an explicit moneyEntitled flag, conservative default. */
interface EntitlementInput {
  readonly roles?: readonly string[];
  readonly moneyEntitled?: boolean;
}

/** The phase-defining descriptor: projected data + the withheld FieldPath listing. */
interface PipelineDescriptor {
  readonly data: PipelineData;
  readonly entitlements: { readonly withheld: readonly string[] };
}

// Green phase: import { projectWithEntitlements } from "@/server/read-models/entitlements";
function projectWithEntitlements(
  full: PipelineAggregate,
  input?: EntitlementInput,
): PipelineDescriptor {
  void full;
  void input;
  return notYetImplemented();
}

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
  { skip: true },
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
  { skip: true },
  () => {
    const { data } = projectWithEntitlements(FULL_AGGREGATE, { moneyEntitled: false });
    // Explicitly reject the two dishonest-present shapes the precedent must never take.
    assert.notEqual(data.acceptedValueOre, null);
    assert.notEqual(data.acceptedValueOre, 0);
  },
);

test(
  "10.4-UNIT-01: conservative single-role default — tenant_admin ⇒ money-entitled ⇒ withheld is [] and the amount is PRESENT",
  { skip: true },
  () => {
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE, {
      roles: ["tenant_admin"],
    });
    assert.deepEqual([...entitlements.withheld], []);
    assert.equal(data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
  },
);

test(
  "10.4-UNIT-01: absent/omitted entitlement input falls back to the conservative tenant_admin default (withheld [])",
  { skip: true },
  () => {
    // Under B1a everyone IS tenant_admin (EB-A4); the baked-in default must be money-entitled so
    // runtime `withheld` is [] today — the unentitled path is proven by an explicit input above.
    const { data, entitlements } = projectWithEntitlements(FULL_AGGREGATE);
    assert.deepEqual([...entitlements.withheld], []);
    assert.equal(data.acceptedValueOre, FULL_AGGREGATE.acceptedValueOre);
  },
);

test(
  "10.4-UNIT-01: counts + hit rate are NEVER withheld — present and unchanged for an unentitled input",
  { skip: true },
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
  { skip: true },
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
  { skip: true },
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
