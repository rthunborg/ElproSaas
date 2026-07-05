/**
 * Story 6.1 — ATDD RED-PHASE scaffold: `createQuoteVersionFromCalculation` command +
 * the narrow atomic RPC (AC2/AC3, P0 — 6.1-INT-02..06 / R-602/603/604).
 *
 * These are the headline behavioral proofs of the story:
 *   6.1-INT-02  cross-tenant SOURCE rejection — a Tenant-A create that supplies a
 *               Tenant-B calculation_id OR a Tenant-B attachment/file id is DENIED with
 *               the stable typed `TENANT_ACCESS_DENIED` (calc verified by the envelope
 *               `ownership` step → invisible under A's RLS → denied BEFORE execute; the
 *               foreign file id is re-validated / the composite FK rejects it). No raw
 *               throw/stack/SQL/tenant-existence signal crosses the boundary.
 *   6.1-INT-03  snapshot completeness — the created version captures the FULL §11
 *               checklist: customer/facility/contact display, FULL company identity
 *               (org_nr/address/postal/city/email/phone/logo/company_name — NOT the
 *               identity-partial variant), terms text + sign-off state (approved_at
 *               VERBATIM), line/section display model, base/option/VAT/deduction totals
 *               in integer öre + accepted-price basis, VAT/tax assumptions (bp), selected
 *               attachment metadata, warnings-at-snapshot, source calc id + captured_at.
 *   6.1-INT-04  BEHAVIORAL FREEZE (the single most important correctness property) —
 *               mutate every source class AFTER creation (calc rows / pricing / settings /
 *               terms / CRM) → the persisted snapshot is BYTE-UNCHANGED. Field-exists
 *               assertions are INSUFFICIENT (three-epic precedent); this MUTATES then
 *               re-reads and asserts equality of the stored snapshot bytes.
 *   6.1-INT-05  numbering race-safety — concurrent `Promise.all` creations within ONE
 *               tenant allocate UNIQUE tenant-scoped quote numbers inside the RPC txn
 *               (sleep-free, NO timing); tenant B's sequence is INDEPENDENT of tenant A's.
 *   6.1-INT-06  audit — a version-creation writes an append-only audit row with
 *               allow-listed `{ targetId }` metadata only (no PII / money / customer
 *               values leak into audit).
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * `createQuoteVersionFromCalculation`, its RPC, and the quote tables do not exist yet
 * (Story 6.1 dev Tasks 1/3/4). Kept skipped (project red-phase idiom) so the green tree
 * is not broken before implementation; the DEV phase removes `.skip`, wires the real
 * command import + the new factory seeds (quote/version/line/attachment/event/counter),
 * and fills the TODO markers.
 *
 * ── RAW pg READBACK COERCION ────────────────────────────────────────────────────
 * The freeze + numbering proofs read öre/timestamps back off the raw superuser pool:
 * `bigint` öre returns as STRINGS and `timestamptz` as `Date` — coerce (`Number(...)` /
 * `.toISOString()`) or a `.toBe` fails on representation despite byte-correct storage.
 * Seed per-run unique ids (`crypto.randomUUID()`) for any count assertion.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-6.md 6.1-INT-02..06; story AC2/AC3 / Tasks 3, 4).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";
// RED PHASE: this import does not resolve until Story 6.1 dev Task 3.2 authors the
// command. The dev phase un-skips these suites and this import goes live.
// import { createQuoteVersionFromCalculation } from "@/server/commands/quotes";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantACalcId: string; // A's OWN calc (visible; passes the ownership gate)
let tenantBCalcId: string; // a REAL Tenant B calc (cross-tenant source target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);

  // A's own customer + calc (visible under A's RLS) — the happy-path source.
  const aCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: "tenant-a-own-customer",
    org_nr: "556000-1111",
  });
  tenantACalcId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: aCustomerId,
    title: "tenant-a-calc",
  });

  // A REAL Tenant B calc (existing but A-invisible) so the cross-tenant source points
  // at a concrete target — never a non-existent id that would deny vacuously.
  const bCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-own-customer",
    org_nr: "556000-2222",
  });
  tenantBCalcId = await adminInsertCalculation({
    tenant_id: fixture.tenantB.id,
    customer_id: bCustomerId,
    title: "tenant-b-calc",
  });
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

// RED PHASE: remove `.skip` in dev once the command + RPC + tables land.
describe.skip("createQuoteVersionFromCalculation — cross-tenant source rejection (AC2, 6.1-INT-02)", () => {
  it("[P0] a foreign calculation_id → TENANT_ACCESS_DENIED (envelope ownership gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): const res = await runCommand(createQuoteVersionFromCalculation, {
    //   input: { calculation_id: tenantBCalcId, attachment_file_ids: [] },
    //   client: a, actor: fixture.adminA, clock: fixedClock,
    // });
    // expect(res.ok).toBe(false);
    // expect((res as { error: { code: string } }).error.code).toBe("TENANT_ACCESS_DENIED");
    expect.fail("RED PHASE: createQuoteVersionFromCalculation not implemented yet");
  });

  it("[P0] a foreign attachment/file id → TENANT_ACCESS_DENIED (re-validated / composite FK)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): seed a REAL Tenant-B file id; pass it as an attachment on an A-owned
    // calc create; assert TENANT_ACCESS_DENIED and NO orphaned quote/version/number.
    expect.fail("RED PHASE: attachment ownership re-validation not implemented yet");
  });

  it("[P0] no raw throw/stack/SQL/tenant-existence signal crosses the boundary", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): assert the error is the typed Result code only — never a raw pg error,
    // stack, SQL text, or a signal distinguishing "foreign id exists" from "not found".
    expect.fail("RED PHASE: boundary error-hygiene not implemented yet");
  });
});

describe.skip("createQuoteVersionFromCalculation — snapshot completeness (AC2, 6.1-INT-03)", () => {
  it("[P0] captures the full §11 checklist incl. FULL company identity + terms sign-off + warnings + source refs", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): create a version from an A-owned calc that exercises the full field set
    // (customer/facility/contact display, org_nr/address/postal/city/email/phone/logo/
    //  company_name, terms text + approved_at verbatim, lines/sections display model,
    //  base/option/VAT/deduction totals in öre + accepted-price basis, VAT/tax bp
    //  assumptions, selected attachment metadata, warnings-at-snapshot, calculation_id +
    //  captured_at). Read the persisted quote_versions row back off the raw pool and
    //  assert EVERY §11 field is present and equal to the source STATE at capture time.
    expect.fail("RED PHASE: snapshot completeness not implemented yet");
  });

  it("[P0] captures FULL identity — NOT the identity-partial CompanySettingsSnapshot variant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): assert org_nr/address/postal/city/email/phone/logo are all present in
    // the persisted snapshot (a naive reuse of the partial variant would drop them).
    expect.fail("RED PHASE: full-identity capture not implemented yet");
  });
});

describe.skip("createQuoteVersionFromCalculation — BEHAVIORAL FREEZE (AC2, 6.1-INT-04)", () => {
  it("[P0] mutating calc rows / pricing / settings / terms / CRM AFTER creation leaves the snapshot BYTE-UNCHANGED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // THE HEADLINE PROOF (mirrors 5.3 / Epic-3 / Epic-4 mutate-after-capture).
    // TODO(dev):
    //  1. create a version from an A-owned calc; read + snapshot the full persisted
    //     quote_versions row (coerce bigint→Number, timestamptz→toISOString).
    //  2. MUTATE every source class after creation:
    //       - a calc row's label/sell öre; the calc's customer display name;
    //       - a work_role/article price; company_settings identity/vat; quote_terms text
    //         + approved_at; the linked facility/contact.
    //  3. re-read the SAME quote_versions row (+ its lines/attachments) and assert it is
    //     byte-for-byte identical to step 1. Field-EXISTS assertions are INSUFFICIENT —
    //     the mutation MUST have happened and the snapshot MUST NOT have moved.
    expect.fail("RED PHASE: behavioral freeze not implemented yet");
  });
});

describe.skip("createQuoteVersionFromCalculation — numbering race-safety (AC3, 6.1-INT-05)", () => {
  it("[P0] concurrent creations within one tenant allocate UNIQUE quote numbers (Promise.all, sleep-free)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): fire N concurrent createQuoteVersionFromCalculation for Tenant A via
    // Promise.all (NO sleep/timing). Collect the allocated quote numbers; assert they are
    // all distinct and contiguous — the increment + insert share ONE RPC txn so a number
    // can never be allocated without a version or duplicated under concurrency.
    expect.fail("RED PHASE: race-safe numbering not implemented yet");
  });

  it("[P0] tenant B's quote-number sequence is INDEPENDENT of tenant A's", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): allocate numbers in A and B; assert B's sequence starts from B's own
    // counter (tenant_counters is keyed by (tenant_id, 'quote_number')), not continued
    // from A's — cross-tenant sequence bleed is a leak.
    expect.fail("RED PHASE: per-tenant counter independence not implemented yet");
  });

  it("[P0] a failure mid-RPC rolls back the WHOLE txn — no orphaned number, no partial version", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): force a failure after the counter increment (e.g. an invalid line) and
    // assert the counter did NOT advance and no quote/version/line/event persisted.
    expect.fail("RED PHASE: atomic rollback not implemented yet");
  });
});

describe.skip("createQuoteVersionFromCalculation — audit (AC2/AC3, 6.1-INT-06)", () => {
  it("[P0/P1] writes an append-only audit row with allow-listed { targetId } metadata only", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // TODO(dev): create a version; read audit_events for the actor; assert exactly one
    // row for the create action, metadata is { targetId } ONLY (no PII / money / customer
    // values leak into audit).
    expect.fail("RED PHASE: audit write not implemented yet");
  });
});
