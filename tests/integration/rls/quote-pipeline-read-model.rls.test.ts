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
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * `src/server/read-models/quote-pipeline.ts` is landed; the suite imports the REAL `readQuotePipeline`,
 * binds the RLS-scoped harness client via the `deps.client` seam, and is unskipped. The structural
 * `readFileSync` is guarded by `existsSync`. Run against a freshly `supabase db reset` LOCAL stack
 * (`SUPABASE_TEST_REQUIRED=1` hard-fails on an unreset/unreachable stack — the post-reset false-green
 * trap). The structural assertion + the cross-tenant proof are the CONTRACT.
 *
 * [Source: story 10.4 AC4 + Task 6.2 + SETTLED DESIGN DECISION 1 (RLS client only) + Dev Notes
 *  "The security floor is §3.6"; src/server/db/supabase-server-client.ts (anon-key RLS client);
 *  test-design-epic-10.md#10.4-INT-01, R-1041]
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
  adminInsertQuoteAcceptance,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { readQuotePipeline } from "@/server/read-models/quote-pipeline";
import {
  resolvePipelinePeriod,
  type PipelinePeriod,
} from "@/server/read-models/quote-pipeline-aggregate";

const READ_MODEL_SOURCE = path.join(
  process.cwd(),
  "src",
  "server",
  "read-models",
  "quote-pipeline.ts",
);

// A FIXED seed instant, with the period window DERIVED from it (the same pure helper the read-model
// uses). Seeding every event at SEED_INSTANT and deriving the window from SEED_INSTANT keeps the
// seeded events UNAMBIGUOUSLY in-window at any wall-clock time — no hardcoded-July time-bomb where a
// run after July 2026 would push default-`now()` events out of window and read 0 for the WRONG reason.
const SEED_INSTANT = "2026-07-15T12:00:00.000Z";
const WINDOW: PipelinePeriod = resolvePipelinePeriod(SEED_INSTANT);

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

describe("10.4-INT-01: pipeline read-model isolation floor (RLS-client-only, cross-tenant)", () => {
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
    // Seed B's lifecycle events with an EXPLICIT in-window occurred_at (not the default run-time now())
    // so the window/event relationship is deterministic across any run date.
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: bQuote, quote_version_id: bVersion, event_type: "sent", occurred_at: SEED_INSTANT });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: bQuote, quote_version_id: bVersion, event_type: "accepted", occurred_at: SEED_INSTANT });
    // A's RLS-scoped read-model must see NONE of tenant B's pipeline. The `deps.client` seam binds
    // tenant A's authed harness client; production resolves the request client. Pass an EXPLICIT
    // money-entitled input (the B1a all-tenant_admin reality) — the entitlement resolver is FAIL-CLOSED
    // on an OMITTED input (10.4 review hardening), so an entitled caller states its role set.
    const result = await readQuotePipeline(WINDOW, { roles: ["tenant_admin"] }, { client: a });
    expect(result.data.sentCount).toBe(0);
    expect(result.data.acceptedCount).toBe(0);
    expect(result.data.lostCount).toBe(0);
    // The money aggregate for an empty tenant is 0 (present — entitled tenant_admin), never B's sum.
    expect(result.data.acceptedValueOre).toBe(0);
  });

  it("cross-tenant: tenant A's read-model reflects EXACTLY A's own in-period lifecycle events (never B's)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    // This test runs on a FRESH fixture where tenant A has been seeded NOTHING yet (the prior test
    // seeded tenant B only). So after seeding exactly ONE in-window sent version for A, A's read-model
    // must report sentCount === 1 — B's parallel sent+accepted lifecycle (seeded on the same fixture)
    // does NOT bleed in. A tautological `>= 0` would pass even on a total isolation failure; the exact
    // `=== 1` genuinely proves A sees its OWN seed and only its own.
    const tid = fixture.tenantA.id;
    const aCustomer = await adminInsertCustomer({ tenant_id: tid, customer_type: "company", display_name: "Kund A" });
    const aCalc = await adminInsertCalculation({ tenant_id: tid, customer_id: aCustomer });
    const aQuote = await adminInsertQuote({ tenant_id: tid, customer_id: aCustomer });
    const aVersion = await adminInsertQuoteVersion({
      tenant_id: tid, quote_id: aQuote, calculation_id: aCalc, status: "sent",
    });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: aQuote, quote_version_id: aVersion, event_type: "sent", occurred_at: SEED_INSTANT });
    const result = await readQuotePipeline(WINDOW, { roles: ["tenant_admin"] }, { client: a });
    // A's counts are driven by A's events ONLY (RLS scopes every underlying query to A). Exactly one
    // sent version was seeded for A; B's sent version (from the sibling test) must NOT be counted.
    expect(result.data.sentCount).toBe(1);
    // B seeded an ACCEPTED event; if it leaked, A's acceptedCount would be > 0. It must stay 0.
    expect(result.data.acceptedCount).toBe(0);
    expect(result.data.lostCount).toBe(0);
    expect(result.entitlements.withheld).toEqual([]); // explicit tenant_admin ⇒ money entitled
  });

  it("money: acceptedValueOre sums the ACCEPTED commitment (quote_acceptances), NOT the frozen sent total (quote_versions)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    // Seed for tenant A an accepted version whose FROZEN sent total differs from the ACCEPTED price
    // (an adjusted-price acceptance). The pipeline money leaf must report what was ACCEPTED (the
    // quote_acceptances.accepted_price_ore), never the version's frozen sent total (10.4 review).
    const tid = fixture.tenantA.id;
    const SENT_TOTAL_ORE = 900_000; // 9 000,00 kr — the frozen sent total on the version
    const ACCEPTED_ORE = 750_000; // 7 500,00 kr — the ADJUSTED accepted commitment
    const customer = await adminInsertCustomer({ tenant_id: tid, customer_type: "company", display_name: "Kund Money A" });
    const calc = await adminInsertCalculation({ tenant_id: tid, customer_id: customer });
    const quote = await adminInsertQuote({ tenant_id: tid, customer_id: customer });
    const version = await adminInsertQuoteVersion({
      tenant_id: tid, quote_id: quote, calculation_id: calc, status: "accepted", accepted_price_ore: SENT_TOTAL_ORE,
    });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: quote, quote_version_id: version, event_type: "sent", occurred_at: SEED_INSTANT });
    await adminInsertQuoteEvent({ tenant_id: tid, quote_id: quote, quote_version_id: version, event_type: "accepted", occurred_at: SEED_INSTANT });
    await adminInsertQuoteAcceptance({
      tenant_id: tid, quote_id: quote, quote_version_id: version,
      accepted_price_ore: ACCEPTED_ORE, source_sent_total_ore: SENT_TOTAL_ORE, accepted_at: SEED_INSTANT,
    });
    const result = await readQuotePipeline(WINDOW, { roles: ["tenant_admin"] }, { client: a });
    // The money leaf reports exactly the accepted commitment (the review-mandated source), never the
    // frozen sent total — a value between them would prove the wrong column is summed.
    expect(result.data.acceptedValueOre).toBe(ACCEPTED_ORE);
    expect(result.data.acceptedValueOre).not.toBe(SENT_TOTAL_ORE);
  });

  it("fail-closed: the read-model with an OMITTED entitlement input withholds the money leaf (defense-in-depth)", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    // The least-known caller (no entitlement input) is the MOST guarded — the read-model must NOT
    // expose the money aggregate on an omitted input (10.4 review hardening, R-1040). An entitled
    // caller states an explicit role set (the sibling tests above); this proves the default is closed.
    const result = await readQuotePipeline(WINDOW, undefined, { client: a });
    expect(Object.prototype.hasOwnProperty.call(result.data, "acceptedValueOre")).toBe(false);
    expect(result.entitlements.withheld).toContain("acceptedValueOre");
  });
});
