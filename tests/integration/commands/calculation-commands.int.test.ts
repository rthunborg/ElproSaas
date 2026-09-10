/**
 * Story 5.1 — calculation command-envelope acceptance (AC2/AC6/AC7, P0/P1 —
 * 5.1-INT-03/04/05).
 *
 * The canonical calc command happy/failure paths exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope (architecture §5 steps 1-9), reusing the
 * EXISTING two-tenant factories + the EXISTING `audit_events` BYPASSRLS read helper
 * + the injectable `CommandClock` — NO new auth/error/audit mechanism.
 *
 * COVERAGE (test-design-epic-5.md 5.1-INT-03/04/05; story AC2/AC6/AC7 / Task 3 / 5.3):
 *   - happy-path create calc → persisted row + EXACTLY ONE calc-lifecycle audit row
 *     (per-run unique correlationId; database-owned audit timestamp),
 *   - happy-path create section/row → persisted under the correct parent with a
 *     server-owned sort_order,
 *   - VALIDATION_FAILED for bad row_type / non-positive qty / empty unit / float-or-
 *     negative öre / missing VAT assumption / illegal lifecycle transition — raw value
 *     never echoed (the failure Result carries no data),
 *   - archive sets `archived_at` (soft-delete; independent BYPASSRLS read proves the row
 *     still exists — no hard delete),
 *   - atomic reorder rollback: a mid-transaction failure leaves NO partial order/rows.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertMembership,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  expectDatabaseOwnedTimestamp,
  readDatabaseNow,
} from "../../support/database-time";
import { runCommand } from "@/server/commands/envelope";
import {
  createCalculation,
  updateCalculation,
  archiveCalculation,
  createRow,
  updateRow,
  reorderRows,
  reorderSections,
} from "@/server/commands/calculations";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-02T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** A REAL own-tenant calc + section + rows seeded via the service-role factories. */
interface SeededCalc {
  readonly customerId: string;
  readonly calcId: string;
  readonly sectionId: string;
  readonly rowIds: readonly string[];
}

/**
 * Seed a REAL Tenant-A customer → calc → section → 3 rows (BYPASSRLS service-role
 * path) so a create-row / archive / reorder test has a concrete own-tenant parent to
 * build under. Fresh per call (unique ids) so repeated non-reset local runs never
 * collide. The composite same-tenant FKs force the whole chain into Tenant A.
 */
async function seedTenantACalcWithSection(tenantId: string): Promise<SeededCalc> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: "tenant-a-calc-owner",
    org_nr: "556000-3333",
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: "tenant-a-calc-seed",
  });
  const sectionId = await adminInsertSection({
    tenant_id: tenantId,
    calculation_id: calcId,
    title: "tenant-a-section-seed",
  });
  const rowIds: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    rowIds.push(
      await adminInsertRow({
        tenant_id: tenantId,
        section_id: sectionId,
        row_type: "labor",
        unit_cost_ore: 45000,
        unit_sell_ore: 85000,
        sort_order: i,
      }),
    );
  }
  return { customerId, calcId, sectionId, rowIds };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let projectManager: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  await adminInsertMembership({
    tenant_id: fixture.tenantA.id,
    user_id: fixture.orphanUser.id,
    role: "projektledare",
    status: "active",
  });
  projectManager = await makeAuthedServerClient(fixture.orphanUser);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Calc commands via the envelope (AC2/AC6/AC7 / 5.1-INT-03/04/05)", () => {
  it("[P0][11.2] Projektledare calculation creation is atomic and direct calculation DML is closed", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await adminInsertCustomer({
      tenant_id: fixture.tenantA.id,
      customer_type: "company",
      display_name: `pm-calculation-${crypto.randomUUID()}`,
    });
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createCalculation, {
      client: projectManager as never,
      input: { customer_id: customerId, title: "Projektledarens kalkyl" },
      correlationId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.orphanUser.id,
      command: "calculation.create",
      event_type: "calculation.created",
      target_type: "calculation",
      target_id: result.data.targetId,
    });

    // The policy can still select Projectledare's calculation rows, but table
    // INSERT is intentionally unavailable: a raw PostgREST call cannot bypass
    // the checked wrapper's actor-bound audit transaction.
    const direct = await projectManager
      .from("calculations")
      .insert({
        tenant_id: fixture.tenantA.id,
        customer_id: customerId,
        title: "unaudited bypass",
      });
    expect(direct.error).not.toBeNull();
  });

  it("[P1] createCalculation persists the row and writes EXACTLY ONE audit_events row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { customerId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const correlationId = crypto.randomUUID(); // append-only audit → unique per run
    const databaseBefore = await readDatabaseNow();

    const result = await runCommand(createCalculation, {
      client: a as never,
      input: { customer_id: customerId, title: "Ombyggnad kontor" },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const calcId = (result.data as { targetId: string }).targetId;

    // The row persisted under Tenant A with the resolved tenant + status 'draft'.
    const persisted = await adminQuery<{ tenant_id: string; status: string }>(
      `select tenant_id, status from public.calculations where id = $1`,
      [calcId],
    );
    expect(persisted.length).toBe(1);
    expect(persisted[0].tenant_id).toBe(fixture.tenantA.id);
    expect(persisted[0].status).toBe("draft");

    // EXACTLY ONE calc-lifecycle audit row; the database owns its evidence timestamp.
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.tenant_id).toBe(fixture.tenantA.id); // resolved tenant, NOT a client tenant_id
    expect(row.actor_user_id).toBe(fixture.adminA.id);
    expect(row.command).toBe("calculation.create");
    expect(row.event_type).toBe("calculation.created");
    expect(row.target_type).toBe("calculation");
    expect(row.target_id).toBe(calcId);
    expectDatabaseOwnedTimestamp(row.created_at, databaseBefore, databaseAfter, FIXED_ISO);

    // Audit metadata carries NO PII / money / customer values (SAFE_FIELDS allow-list).
    const serialized = JSON.stringify(row.metadata ?? {});
    expect(serialized.includes("Ombyggnad kontor")).toBe(false);
  });

  it("[P1] createRow persists under the correct parent with a server-owned sort_order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1.5,
        unit: "h",
        unit_cost_ore: 45000,
        unit_sell_ore: 85000,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rowId = (result.data as { targetId: string }).targetId;

    // Independent BYPASSRLS read proves the row persisted under the right parent
    // with a server-owned sort_order (ordering authority is the server, not the client).
    const persisted = await adminQuery<{ section_id: string; sort_order: number }>(
      `select section_id, sort_order from public.calculation_rows where id = $1`,
      [rowId],
    );
    expect(persisted.length).toBe(1);
    expect(persisted[0].section_id).toBe(sectionId);
    expect(persisted[0].sort_order).not.toBeNull();
    // The 3 seeded rows carry sort_order 0..2, so the appended row is 3 (server-owned).
    expect(persisted[0].sort_order).toBe(3);
  });

  it("[P0/10.6-AC2] option selection persists coherent invoice inclusion through the real command", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);

    const created = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 100_000,
        vat_rate_bp: 2_500,
        is_optional: true,
        is_selected: false,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rowId = (created.data as { targetId: string }).targetId;

    const assertState = async (isSelected: boolean, included: boolean) => {
      const rows = await adminQuery<{
        is_selected: boolean;
        included_in_invoice_total: boolean;
      }>(
        `select is_selected, included_in_invoice_total
           from public.calculation_rows
          where id = $1`,
        [rowId],
      );
      expect(rows).toEqual([
        { is_selected: isSelected, included_in_invoice_total: included },
      ]);
    };

    await assertState(false, false);

    const selected = await runCommand(updateRow, {
      client: a as never,
      input: { id: rowId, is_selected: true },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(selected.ok).toBe(true);
    await assertState(true, true);

    const unselected = await runCommand(updateRow, {
      client: a as never,
      input: { id: rowId, is_selected: false },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(unselected.ok).toBe(true);
    await assertState(false, false);
  });

  it("[P0] VALIDATION_FAILED for a row_type outside the closed 5-value union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "consulting", // not in labor/material/subcontractor/machinery/other
        quantity: 1,
        unit: "st",
        unit_sell_ore: 10000,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      // The raw invalid value is NEVER echoed back — the failure Result carries no data.
      expect("data" in result).toBe(false);
    }
  });

  it("[P0] VALIDATION_FAILED for a non-positive quantity", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 0,
        unit: "st",
        unit_sell_ore: 10000,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED for an empty unit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 2,
        unit: "",
        unit_sell_ore: 10000,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED for a float öre money value (öre are whole integers)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 1,
        unit: "st",
        unit_sell_ore: 100.5, // float — rejected by canonical isOreAmount
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      // The raw invalid öre value is NEVER echoed back (R-506 no-echo discipline).
      expect(JSON.stringify(result).includes("100.5")).toBe(false);
    }
  });

  it("[P0] VALIDATION_FAILED for a negative öre money value", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 1,
        unit: "st",
        unit_sell_ore: -1, // negative — Phase A has no discount/negative money
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED when the VAT assumption is missing or malformed", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 85000,
        // vat_rate_bp intentionally omitted — the VAT assumption is required + bp-shaped
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED for an illegal lifecycle transition / unknown status on updateCalculation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { calcId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    // An unknown status value is rejected by the lifecycle state machine.
    const result = await runCommand(updateCalculation, {
      client: a as never,
      input: { id: calcId, status: "not_a_status" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] archiveCalculation sets archived_at (soft-delete) and the row is NOT hard-deleted", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { calcId } = await seedTenantACalcWithSection(fixture.tenantA.id);

    const archived = await runCommand(archiveCalculation, {
      client: a as never,
      input: { id: calcId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);

    // Independent BYPASSRLS read proves the row still EXISTS with archived_at set —
    // a soft-delete, never a hard DELETE. archived_at == the single injected instant.
    const row = await adminQuery<{ archived_at: string | null; status: string }>(
      `select archived_at, status from public.calculations where id = $1`,
      [calcId],
    );
    expect(row.length).toBe(1);
    expect(row[0].archived_at).not.toBeNull();
    expect(new Date(row[0].archived_at as string).toISOString()).toBe(FIXED_ISO);
    // status is flipped to 'archived' so the lifecycle field and the soft-delete agree.
    expect(row[0].status).toBe("archived");
  });

  it("[P0][11.2] the public audited calculation RPC cannot revive an archived calculation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { calcId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    const archived = await runCommand(archiveCalculation, {
      client: projectManager as never,
      input: { id: calcId },
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);
    const direct = await (projectManager as never as {
      rpc(name: string, args: Record<string, unknown>): Promise<{ error: { code?: string } | null }>;
    }).rpc("update_calculation_with_audit", {
      p_tenant_id: fixture.tenantA.id,
      p_actor_user_id: fixture.orphanUser.id,
      p_correlation_id: crypto.randomUUID(),
      p_calculation_id: calcId,
      p_patch: { status: "ready" },
    });
    expect(direct.error?.code).toBe("23514");
    const row = await adminQuery<{ status: string; archived_at: string | null }>(
      "select status, archived_at from public.calculations where id = $1", [calcId],
    );
    expect(row[0]).toMatchObject({ status: "archived" });
    expect(row[0]?.archived_at).not.toBeNull();
  });

  it("[P0/AC2] updateCalculation cannot revive an ARCHIVED calc — the state machine is authoritative against the real DB row (findings 1 & 2)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { calcId } = await seedTenantACalcWithSection(fixture.tenantA.id);

    // Archive the calc first (status → 'archived', archived_at set).
    const archived = await runCommand(archiveCalculation, {
      client: a as never,
      input: { id: calcId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);

    // Attempt an illegal revive: { id, status: 'ready' } with NO honest currentStatus.
    // Under the OLD (client-trusted) path this defaulted to draft→ready and was wrongly
    // accepted; the DB-authoritative check loads the REAL 'archived' status and blocks it.
    const revive = await runCommand(updateCalculation, {
      client: a as never,
      input: { id: calcId, status: "ready" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(revive.ok).toBe(false);
    if (!revive.ok) expect(revive.code).toBe("VALIDATION_FAILED");

    // BYPASSRLS re-read proves the row is UNCHANGED: still archived, archived_at intact
    // (status and archived_at cannot silently disagree — finding 2).
    const row = await adminQuery<{ archived_at: string | null; status: string }>(
      `select archived_at, status from public.calculations where id = $1`,
      [calcId],
    );
    expect(row.length).toBe(1);
    expect(row[0].status).toBe("archived");
    expect(row[0].archived_at).not.toBeNull();
  });

  it("[P0/AC6] an atomic reorder that fails mid-transaction rolls back FULLY — no partial order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId, rowIds } = await seedTenantACalcWithSection(fixture.tenantA.id);

    // Capture the pre-reorder ordering, then submit a reorder whose LAST item is invalid
    // (an id that does not belong to the section) so the narrow RPC's transaction aborts.
    const before = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_rows
         where section_id = $1 order by sort_order`,
      [sectionId],
    );
    expect(before.length).toBe(3); // guard: the seed produced the rows we reorder

    const result = await runCommand(reorderRows, {
      client: a as never,
      input: {
        section_id: sectionId,
        // a valid reshuffle of the real ids + one bogus id last → the whole txn aborts
        ordered_row_ids: [...rowIds].reverse().concat(crypto.randomUUID()),
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    // The command reports failure AND the ordering is UNCHANGED — no partial order was
    // committed (ADR-A009 narrow RPC owns the transaction boundary + rollback, R-503).
    expect(result.ok).toBe(false);
    const after = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_rows
         where section_id = $1 order by sort_order`,
      [sectionId],
    );
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(after.map((r) => r.sort_order)).toEqual(before.map((r) => r.sort_order));
  });

  it("[P0/AC6] a fully-valid atomic reorder commits the new server-owned order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { sectionId, rowIds } = await seedTenantACalcWithSection(fixture.tenantA.id);
    // Reverse the seeded order (0,1,2) → (2,1,0). All ids are real same-section rows, so
    // the narrow RPC commits the new sort_order by array position.
    const reversed = [...rowIds].reverse();
    const result = await runCommand(reorderRows, {
      client: a as never,
      input: { section_id: sectionId, ordered_row_ids: reversed },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    // The RPC assigns sort_order = array ordinal (1-based). Read back: the first supplied
    // id has the lowest sort_order.
    const after = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_rows
         where section_id = $1 order by sort_order`,
      [sectionId],
    );
    expect(after.map((r) => r.id)).toEqual(reversed);
  });

  it("[P0/AC6] reorderSections commits a valid section reorder and rolls a bad payload back FULLY", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { calcId } = await seedTenantACalcWithSection(fixture.tenantA.id);
    // Seed two MORE sections under the same calc so there is a real multi-section order.
    const s2 = await adminInsertSection({
      tenant_id: fixture.tenantA.id,
      calculation_id: calcId,
      title: "section-2",
      sort_order: 1,
    });
    const s3 = await adminInsertSection({
      tenant_id: fixture.tenantA.id,
      calculation_id: calcId,
      title: "section-3",
      sort_order: 2,
    });
    const before = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_sections
         where calculation_id = $1 order by sort_order`,
      [calcId],
    );
    const orderedIds = before.map((r) => r.id);
    expect(orderedIds).toContain(s2);
    expect(orderedIds).toContain(s3);

    // A bad payload (a bogus section id last) aborts the whole reorder — no partial order.
    const bad = await runCommand(reorderSections, {
      client: a as never,
      input: {
        calculation_id: calcId,
        ordered_section_ids: [...orderedIds].reverse().concat(crypto.randomUUID()),
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(bad.ok).toBe(false);
    const afterBad = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_sections
         where calculation_id = $1 order by sort_order`,
      [calcId],
    );
    expect(afterBad.map((r) => r.id)).toEqual(orderedIds); // unchanged (R-503 rollback)

    // A fully-valid reversal commits the new server-owned order.
    const reversed = [...orderedIds].reverse();
    const good = await runCommand(reorderSections, {
      client: a as never,
      input: { calculation_id: calcId, ordered_section_ids: reversed },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(good.ok).toBe(true);
    const afterGood = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_sections
         where calculation_id = $1 order by sort_order`,
      [calcId],
    );
    expect(afterGood.map((r) => r.id)).toEqual(reversed);
  });
});
