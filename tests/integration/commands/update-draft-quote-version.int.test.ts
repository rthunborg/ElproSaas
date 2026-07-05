/**
 * Story 6.2 — `updateDraftQuoteVersion` command (Task 5.4; R-605/R-616, Testability Note 2).
 *
 * The load-bearing draft-only edit-scope proof BELOW the UI (a disabled button is NOT
 * evidence — the enforcement must be at the command). Exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope:
 *   (a) a DRAFT-status version accepts an allowed customer-visible presentational edit and the
 *       row UPDATES (readback confirms the frozen row changed in place);
 *   (b) a SENT (and an ACCEPTED) version REJECTS the edit with the stable typed
 *       `QUOTE_VERSION_NOT_DRAFT` (the re-assert-draft guard fires) AND the row is UNCHANGED;
 *   (c) a foreign-tenant version id → `TENANT_ACCESS_DENIED` (the envelope ownership gate);
 *   (d) a draft edit NEVER touches lines/price/VAT/status (scope guard).
 *
 * Mirrors the 6.1 quote-version.int.test.ts DB-backed discipline: per-run unique ids, raw pg
 * readback via the BYPASSRLS admin helpers, runs against the LOCAL Supabase stack only and
 * skips visibly when unreachable. AFTER a `supabase db reset` the runner polls
 * `/auth/v1/health` to 200 before this suite (Kong→GoTrue 502 false-green — the 6-1 retro trap).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionLine,
  adminSelectQuoteVersionRow,
  adminSelectQuoteVersionLines,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { updateDraftQuoteVersion } from "@/server/commands/quotes";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-05T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** Seed a quote + one version of the given status for a tenant. Returns ids for the readback. */
async function seedQuoteVersion(
  tenantId: string,
  status: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `quote-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `quote-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const quoteId = await adminInsertQuote({
    tenant_id: tenantId,
    customer_id: customerId,
  });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calcId,
    status,
    intro_text: "ursprunglig introtext",
  });
  return { quoteId, versionId };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("updateDraftQuoteVersion — draft accepts an allowed edit (AC2)", () => {
  it("[P0] a DRAFT version accepts an intro-text edit and the frozen row updates in place", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { quoteId, versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: {
        quote_version_id: versionId,
        intro_text: "uppdaterad introtext",
        customer_notes: "kundnotering",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.targetId).toBe(versionId);

    const row = await adminSelectQuoteVersionRow(versionId);
    expect(row?.intro_text).toBe("uppdaterad introtext");
    expect(row?.customer_notes).toBe("kundnotering");
    // The lifecycle status is UNCHANGED (a draft edit never flips status).
    expect(row?.status).toBe("draft");
    void quoteId;
  });

  it("[P0] a draft edit does NOT touch the version's lines (scope guard)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "draft");
    await adminInsertQuoteVersionLine({
      tenant_id: fixture.tenantA.id,
      quote_version_id: versionId,
      label: "rad-1",
      unit_sell_ore: 85000,
      sort_order: 0,
    });
    const before = await adminSelectQuoteVersionLines(versionId);

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: { quote_version_id: versionId, intro_text: "annan text" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(res.ok).toBe(true);

    const after = await adminSelectQuoteVersionLines(versionId);
    expect(after.length).toBe(before.length);
    expect(after[0]?.unit_sell_ore).toBe(before[0]?.unit_sell_ore);
    expect(after[0]?.label).toBe(before[0]?.label);
  });
});

describe("updateDraftQuoteVersion — non-draft rejection BELOW the UI (AC2/AC3)", () => {
  it("[P0] a SENT version REJECTS the edit with QUOTE_VERSION_NOT_DRAFT and stays unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "sent");
    const before = await adminSelectQuoteVersionRow(versionId);

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: { quote_version_id: versionId, intro_text: "försök att ändra en skickad" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("QUOTE_VERSION_NOT_DRAFT");
    // No raw pg / stack / SQL / status leak in the message.
    expect(res.message).not.toMatch(/update|select|status|stack|23514/i);
    // The row is byte-unchanged (the guard fired BEFORE any write).
    const after = await adminSelectQuoteVersionRow(versionId);
    expect(after?.intro_text).toBe(before?.intro_text);
    expect(after?.status).toBe("sent");
  });

  it("[P0] an ACCEPTED version REJECTS the edit with QUOTE_VERSION_NOT_DRAFT", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { versionId } = await seedQuoteVersion(fixture.tenantA.id, "accepted");

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never,
      input: { quote_version_id: versionId, customer_notes: "nope" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("QUOTE_VERSION_NOT_DRAFT");
  });
});

describe("updateDraftQuoteVersion — cross-tenant rejection (AC2)", () => {
  it("[P0] a foreign-tenant (Tenant B) version id → TENANT_ACCESS_DENIED (ownership gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A REAL Tenant-B draft version (existing but A-invisible) — never a non-existent id.
    const { versionId: bVersionId } = await seedQuoteVersion(fixture.tenantB.id, "draft");
    const before = await adminSelectQuoteVersionRow(bVersionId);

    const res = await runCommand(updateDraftQuoteVersion, {
      client: a as never, // adminA acting on a Tenant-B version id
      input: { quote_version_id: bVersionId, intro_text: "cross-tenant attempt" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("TENANT_ACCESS_DENIED");
    // No cross-tenant existence signal (same message shape as a not-found id).
    expect(res.message).not.toMatch(/exist|tenant b|another|version/i);
    // The Tenant-B row is untouched.
    const after = await adminSelectQuoteVersionRow(bVersionId);
    expect(after?.intro_text).toBe(before?.intro_text);
  });
});
