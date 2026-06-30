/**
 * GAP G-9 (P3) — auth/RLS performance BASELINE (R-013).
 *
 * Phase A has NO performance SLA for the internal pilot, so this is deliberately a
 * NON-GATING baseline, not a tight perf gate:
 *   - it MEASURES the representative auth/RLS hot paths and LOGS p50/p95/max so the
 *     numbers are visible and a future SLA can be set from real data, and
 *   - it asserts only a GENEROUS ceiling that catches a catastrophic (~10-40×)
 *     regression, never normal local/CI variance — so it does not flake the gate.
 *
 * Set real SLAs post-pilot (R-013); tighten the ceiling then. See
 * `_bmad-output/test-artifacts/perf-baseline-epic-2.md`.
 *
 * Measured paths:
 *   1. `resolveTenantContext` — the full per-request server auth/tenant path
 *      (JWT re-validation via getClaims + the membership read + decision logic).
 *   2. An authed own-tenant RLS read on `tenant_memberships` — exercises the
 *      `is_active_tenant_member` policy predicate end-to-end under RLS.
 *
 * Runs against the LOCAL stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";

// NON-GATING ceiling: a clean local op is well under 100ms; CI runners are slower and
// noisy, so 2000ms only fires on a gross regression. Tighten once an SLA exists (R-013).
const P95_CEILING_MS = 2000;
const ITERATIONS = 30;
const WARMUP = 3; // discard cold-start samples (first connection / JIT / cache fill)

let stackUp = false;
let fixture: TwoTenantFixture;
let authed: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  authed = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

interface Stats {
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
}

async function measure(label: string, op: () => Promise<unknown>): Promise<Stats> {
  for (let i = 0; i < WARMUP; i++) await op();
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await op();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const at = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))];
  const stats: Stats = { p50: at(0.5), p95: at(0.95), max: samples[samples.length - 1] };
  console.log(
    `[perf-baseline] ${label}: p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms max=${stats.max.toFixed(1)}ms (n=${ITERATIONS})`,
  );
  return stats;
}

describe("auth/RLS performance baseline (Gap G-9 / R-013 — NON-GATING)", () => {
  it("[P3] resolveTenantContext stays within the generous baseline ceiling", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const stats = await measure("resolveTenantContext", async () => {
      const result = await resolveTenantContext({ client: authed });
      // Sanity: the measured path actually resolved adminA's tenant (not an error
      // path that would be unrepresentatively fast).
      expect(result.ok).toBe(true);
    });
    expect(stats.p95).toBeLessThan(P95_CEILING_MS);
  });

  it("[P3] an authed own-tenant RLS read stays within the generous baseline ceiling", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const stats = await measure("authed own-tenant RLS read", async () => {
      const { data, error } = await authed
        .from("tenant_memberships")
        .select("id, tenant_id, status");
      expect(error).toBeNull();
      // RLS-filtered to adminA's own active membership — a non-empty, representative read.
      expect((data ?? []).length).toBeGreaterThan(0);
    });
    expect(stats.p95).toBeLessThan(P95_CEILING_MS);
  });
});
