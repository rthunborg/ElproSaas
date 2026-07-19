/**
 * Story 10.4 — the PHASE-DEFINING entitlement descriptor projection (Task 2.1/2.2; AC1; SETTLED
 * DESIGN DECISIONS 2/3; architecture-phase-b §11 / §3.6 tier 3 / §3.1 ADR-B001; AR-B6). This is the
 * sensitive-field withholding MECHANISM the first `src/server/read-models` module ships — and the
 * precedent EVERY later Phase B read-model inherits, so the `{ data, entitlements }` shape must be
 * exactly right (R-1040).
 *
 * ── THE CONTRACT (get it EXACTLY right) ──────────────────────────────────────────────────────────
 *   - A withheld money field is ABSENT from `data` (DELETED — never `null`, never `0`) AND its stable
 *     `FieldPath` string is listed in `entitlements.withheld` (the "absent + listed" rule). The UI
 *     rule (later): absent + listed ⇒ mask/omit column; absent + NOT listed ⇒ genuinely empty. The UI
 *     NEVER consults role names client-side.
 *   - WITHHOLDING TODAY IS A FLAT LEAF LIST: `withholdFields` deletes each named field in
 *     `MONEY_FIELD_PATHS` and lists it. For 10.4 the money aggregate IS the single leaf
 *     `acceptedValueOre`, so this is correct AND complete. It does NOT yet model leaf→aggregate
 *     DEPENDENCY: a later read-model whose aggregate DEPENDS on a withheld leaf would need that
 *     aggregate's own path added to the withheld set by hand — genuine dependency-aware
 *     aggregate-honesty (withhold ANY aggregate depending on a withheld leaf) is DEFERRED to the
 *     first multi-component Phase-B read-model where it is exercisable and testable (see the
 *     10.4 review Defer). Do NOT build speculative untested dependency machinery for one leaf now.
 *   - COUNTS + HIT RATE are NEVER money and are ALWAYS present (never withheld).
 *
 * ── THE MECHANISM, NOT THE N-4 MATRIX (SETTLED DECISION 3 — OWNER-GATED) ─────────────────────────
 * The entitlement input is a role set (or an explicit `moneyEntitled` flag) resolved by a SINGLE,
 * injectable resolver with a CONSERVATIVE default: `tenant_admin ⇒ money-entitled ⇒ withheld: []`.
 * Under B1a everyone IS `tenant_admin` (EB-A4 capability seam), so at runtime `withheld` is `[]` today;
 * the withholding path is PROVEN by driving an UNENTITLED input in the unit test. This file deliberately
 * does NOT create `permission-matrix.ts`, does NOT enumerate the other roles, and does NOT hard-code the
 * confirmed N-4 matrix — Epic 11 (11.2) feeds this SAME seam the real matrix with no rework. The seed is
 * carried as `[gated: N-4]` in the story completion notes; re-confirmed at the owner gate.
 *
 * [Source: story 10.4 AC1 + Tasks 2.1/2.2 + SETTLED DESIGN DECISIONS 2/3; architecture-phase-b §11 /
 *  §3.6 / §3.1 ADR-B001; test-design-epic-10.md#10.4-UNIT-01, R-1040/R-1046]
 */
import type { PipelineAggregate } from "./quote-pipeline-aggregate";

/** A stable field-path string the UI resolves to "mask/omit this column" (never a role name/sentinel). */
export type FieldPath = string;

/**
 * The entitlement-projected data — structurally the aggregate MINUS any withheld money field. The
 * money leaf is OPTIONAL because it is ABSENT (deleted) when withheld (never present-as-null/0).
 */
export interface PipelineData {
  readonly period: PipelineAggregate["period"];
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly lostCount: number;
  readonly hitRate: number | null;
  readonly openFollowUpCount: number;
  readonly overdueFollowUpCount: number;
  /** ABSENT when withheld (never null/0); present + listed-nowhere when entitled. */
  readonly acceptedValueOre?: number;
}

/** The phase-defining descriptor: projected data + the withheld FieldPath listing (`[]` when entitled). */
export interface PipelineDescriptor {
  readonly data: PipelineData;
  readonly entitlements: { readonly withheld: readonly FieldPath[] };
}

/**
 * The entitlement input — a role set OR an explicit `moneyEntitled` flag. A single injectable seam so
 * Epic 11's matrix resolver retrofits it without reshaping the read-model (EB-A4). Conservative default
 * (see `resolveMoneyEntitled`).
 */
export interface EntitlementInput {
  readonly roles?: readonly string[];
  readonly moneyEntitled?: boolean;
}

/**
 * The MONEY leaves that ride the entitlement descriptor — a FLAT withhold list. Today it is exactly the
 * single money leaf `acceptedValueOre`. A later multi-component read-model that adds more money leaves
 * (or an aggregate DEPENDENT on one) must add each dependent path to this list by hand until the
 * deferred dependency-aware helper lands; the list is NOT a dependency graph.
 */
const MONEY_FIELD_PATHS: readonly FieldPath[] = ["acceptedValueOre"];

/**
 * The SINGLE, injectable entitlement resolver with a CONSERVATIVE default (SETTLED DECISION 3): an
 * explicit `moneyEntitled` wins; else a role set is money-entitled iff it contains `tenant_admin`; else
 * (no input at all) the conservative default is money-entitled — the B1a single-role reality where
 * everyone IS `tenant_admin`, so runtime `withheld` is `[]`. NOT the N-4 per-role matrix (Epic 11).
 */
function resolveMoneyEntitled(input?: EntitlementInput): boolean {
  if (input?.moneyEntitled !== undefined) return input.moneyEntitled;
  if (input?.roles !== undefined) return input.roles.includes("tenant_admin");
  return true;
}

/**
 * FLAT withhold list: DELETE each listed field from `data` (so it is ABSENT, never null/0) and return
 * the FieldPath listing of what was removed. This withholds exactly the NAMED leaves in `fieldPaths` —
 * it does NOT inspect leaf→aggregate dependencies, so it is correct-and-complete for 10.4's single money
 * leaf but would need each dependent aggregate path added by hand for a multi-component read-model. The
 * genuine dependency-aware helper ("withhold ANY aggregate depending on a withheld leaf") is deferred to
 * the first multi-component read-model (10.4 review Defer) — no speculative machinery here.
 */
function withholdFields(
  data: Record<string, unknown>,
  fieldPaths: readonly FieldPath[],
): FieldPath[] {
  const withheld: FieldPath[] = [];
  for (const path of fieldPaths) {
    if (path in data) {
      delete data[path];
      withheld.push(path);
    }
  }
  return withheld;
}

/**
 * Project the full (pre-entitlement) aggregate into the `{ data, entitlements }` descriptor, applying
 * the sensitive-field withholding mechanism. When the caller is NOT money-entitled, every money leaf is
 * ABSENT from `data` AND listed in `entitlements.withheld`; counts + hit rate are always present.
 */
export function projectWithEntitlements(
  full: PipelineAggregate,
  input?: EntitlementInput,
): PipelineDescriptor {
  const moneyEntitled = resolveMoneyEntitled(input);

  // Start from a mutable copy carrying every field; withholding then DELETES the withheld leaves so
  // they are ABSENT (never null/0). Non-money fields (counts + hit rate) always survive untouched.
  const data: Record<string, unknown> = {
    period: full.period,
    sentCount: full.sentCount,
    acceptedCount: full.acceptedCount,
    lostCount: full.lostCount,
    hitRate: full.hitRate,
    openFollowUpCount: full.openFollowUpCount,
    overdueFollowUpCount: full.overdueFollowUpCount,
    acceptedValueOre: full.acceptedValueOre,
  };

  const withheld = moneyEntitled ? [] : withholdFields(data, MONEY_FIELD_PATHS);

  return {
    data: data as unknown as PipelineData,
    entitlements: { withheld },
  };
}
