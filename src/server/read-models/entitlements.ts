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
 *   - AGGREGATE HONESTY: any aggregate whose components include a withheld leaf is ITSELF withheld
 *     (absent + listed) — the server never ships a partial sum. For 10.4 the money aggregate is a
 *     single leaf, but the rule is baked into the projection (`withholdFields`) so later multi-
 *     component read-models inherit correct behaviour by extending the leaf/dependency sets.
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
 * The MONEY leaves that ride the entitlement descriptor. A single-field money aggregate today; declared
 * as a set so a later multi-component read-model withholds any aggregate depending on a withheld leaf
 * (aggregate honesty) by extending this list — no reshape of the projection.
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
 * Aggregate-honesty withholding: DELETE each listed field from `data` and return its FieldPath listing.
 * Given the set of withheld leaf paths, an aggregate that depends on a withheld leaf is itself withheld
 * here (absent + listed). For 10.4 the money aggregate IS the single money leaf; the helper is written
 * generally so later read-models inherit the "never ship a partial sum" rule.
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
