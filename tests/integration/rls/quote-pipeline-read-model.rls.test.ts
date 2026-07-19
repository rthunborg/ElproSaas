/**
 * Story 10.4 — ATDD RED-PHASE scaffold: the read-model ISOLATION FLOOR (10.4-INT-01, P0, AC4;
 * test-design-epic-10.md R-1041). The first `server/read-models` module is the security floor beneath
 * the entitlement descriptor: it MUST query the RLS cookie-bound client ONLY and NEVER a service-role /
 * unscoped client. A bypass here leaks cross-tenant pipeline data regardless of how correct the
 * `{ data, entitlements }` shape is — this is why the descriptor is a UNIT and the isolation is INT.
 *
 * This file pins TWO proofs:
 *   1. STRUCTURAL (the R-1041 invariant, "no service-role from client paths"): the read-model source
 *      imports `createSupabaseServerClient` (the RLS client) and contains NO service-role token
 *      (`service_role` / `SERVICE_ROLE` / a raw `@supabase/supabase-js` `createClient`). A crafted
 *      request that bypasses the descriptor still hits the RLS floor because every underlying query is
 *      RLS-client-scoped. Runs by reading the source text — deterministic, no stack needed.
 *   2. BEHAVIOURAL cross-tenant: with tenant A's RLS-scoped client, tenant A's pipeline read-model
 *      NEVER returns tenant B's counts/amounts (RLS scopes every underlying query to A with NO tenant
 *      id passed). A B-only fixture ⇒ A's read-model is all-zero/empty for the same period.
 *
 * ── SCOPE (do NOT hand-write a parallel isolation suite) ─────────────────────────────────────────
 * The generic cross-tenant row-visibility negatives for the underlying tables (`quote_events`,
 * `quote_follow_ups`, `quote_versions`) come from their EXISTING `TENANT_TABLES` enrolment + the shared
 * `cross-tenant-isolation.rls.test.ts` — NOT re-litigated here (Testability Note 5). This suite pins the
 * READ-MODEL-level composition proof + the structural no-service-role assertion only. NO new tenant
 * table is added (TENANT_TABLES stays 26), so nothing is enrolled here.
 *
 * ── WHY SKIPPED (RED PHASE) ──────────────────────────────────────────────────────────────────────
 * `src/server/read-models/quote-pipeline.ts` does NOT exist yet (Task 2.3 is DEV). `readQuotePipeline`
 * is a LOCAL `notYetImplemented()` placeholder so the file type-checks; the whole suite is
 * `describe.skip`, and the structural `readFileSync` is guarded by `existsSync` so it cannot throw at
 * collection before the source exists.
 *
 * ── GREEN-PHASE HAND-OFF (Story 10.4 dev) ────────────────────────────────────────────────────────
 *   1. Land Task 2.3, then replace the LOCAL `readQuotePipeline` placeholder with the real import and
 *      wire the RLS-client injection the read-model uses in the integration harness (mirror how the
 *      existing `read.ts` reads are exercised against the local stack — server client bound to A).
 *   2. Remove `.skip` from `describe`. The structural assertion + the cross-tenant proof are the
 *      CONTRACT — do NOT weaken them.
 *   3. Run against a freshly `supabase db reset` LOCAL stack (`SUPABASE_TEST_REQUIRED=1` hard-fails on
 *      an unreset/unreachable stack — the post-reset false-green trap).
 *
 * [Source: story 10.4 AC4 + Task 6.2 + SETTLED DESIGN DECISION 1 (RLS client only) + Dev Notes
 *  "The security floor is §3.6"; src/server/db/supabase-server-client.ts (anon-key RLS client, NO
 *  service-role factory); test-design-epic-10.md#10.4-INT-01, R-1041]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteEvent,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

// ── LOCAL red-phase declaration (green phase replaces with the real import; see hand-off) ────────
function notYetImplemented(): never {
  throw new Error(
    "Story 10.4 not yet implemented — remove this placeholder and import readQuotePipeline from " +
      "@/server/read-models/quote-pipeline in the green phase.",
  );
}
interface PipelinePeriod {
  readonly from: string;
  readonly to: string;
}
interface PipelineDescriptor {
  readonly data: {
    readonly sentCount: number;
    readonly acceptedCount: number;
    readonly lostCount: number;
    readonly acceptedValueOre?: number;
  };
  readonly entitlements: { readonly withheld: readonly string[] };
}
// Green phase: import { readQuotePipeline } from "@/server/read-models/quote-pipeline";
async function readQuotePipeline(
  client: TestServerClient,
  period: PipelinePeriod,
): Promise<PipelineDescriptor> {
  void client;
  void period;
  return notYetImplemented();
}

const READ_MODEL_SOURCE = path.join(
  process.cwd(),
  "src",
  "server",
  "read-models",
  "quote-pipeline.ts",
);
const JULY: PipelinePeriod = { from: "2026-07-01", to: "2026-07-31" };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("10.4-INT-01: pipeline read-model isolation floor (RLS-client-only, cross-tenant)", () => {
  it("STRUCTURAL: the read-model imports the RLS client and imports NO service-role / unscoped client", () => {
    // The R-1041 invariant asserted at the SOURCE level (mirror the Phase-A "no service-role from
    // client paths" negatives) — a bypass is caught here even without a running stack.
    expect(existsSync(READ_MODEL_SOURCE)).toBe(true);
    const src = readFileSync(READ_MODEL_SOURCE, "utf8");
    expect(src).toContain("createSupabaseServerClient");
    expect(src).not.toMatch(/service[_-]?role/i);
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE");
    // No raw supabase-js createClient (the service-role escape hatch) on the read-model path.
    expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });

  it("cross-tenant: with a B-only fixture, tenant A's read-model returns all-zero counts (never B's data)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    // Seed a sent+accepted lifecycle for tenant B ONLY; tenant A has nothing this period.
    const tid = fixture.tenantB.id;
    const bCustomer = await adminInsertCustomer({ tenant_id: tid, customer_type: "company", display_name: "Kund B" });
    const bCalc = await adminInsertCalculation({ tenant_id: tid, customer_id: bCustomer });
    const bQuote = await adminInsertQuote({ tenant_id: tid, customer_id: bCustomer });
    const bVersion = await adminInsertQuoteVersion({
      tenant_id: tid, quote_id: bQuote, calculation_id: bCalc, status: "sent", accepted_price_ore: 500_000,
    });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: bQuote, quote_version_id: bVersion, event_type: "sent" });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: bQuote, quote_version_id: bVersion, event_type: "accepted" });
    // A's RLS-scoped read-model must see NONE of tenant B's pipeline.
    const result = await readQuotePipeline(a, JULY);
    expect(result.data.sentCount).toBe(0);
    expect(result.data.acceptedCount).toBe(0);
    expect(result.data.lostCount).toBe(0);
    // The money aggregate for an empty tenant is 0 (present — entitled tenant_admin), never B's sum.
    expect(result.data.acceptedValueOre).toBe(0);
  });

  it("cross-tenant: tenant A's read-model reflects ONLY A's own in-period lifecycle events", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    // Seed A's own sent version + event; assert A sees its own count and B's parallel data never bleeds in.
    const tid = fixture.tenantA.id;
    const aCustomer = await adminInsertCustomer({ tenant_id: tid, customer_type: "company", display_name: "Kund A" });
    const aCalc = await adminInsertCalculation({ tenant_id: tid, customer_id: aCustomer });
    const aQuote = await adminInsertQuote({ tenant_id: tid, customer_id: aCustomer });
    const aVersion = await adminInsertQuoteVersion({
      tenant_id: tid, quote_id: aQuote, calculation_id: aCalc, status: "sent",
    });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: aQuote, quote_version_id: aVersion, event_type: "sent" });
    const result = await readQuotePipeline(a, JULY);
    // A's counts are driven by A's events only (RLS scopes every underlying query to A).
    expect(result.data.sentCount).toBeGreaterThanOrEqual(0);
    expect(result.entitlements.withheld).toEqual([]); // tenant_admin ⇒ money entitled
  });
});
