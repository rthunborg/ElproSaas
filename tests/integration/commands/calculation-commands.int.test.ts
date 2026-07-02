/**
 * Story 5.1 — ATDD RED-PHASE scaffold: calculation command-envelope acceptance
 * (AC2/AC6/AC7, P0/P1 — 5.1-INT-03/04/05).
 *
 * The canonical calc command happy/failure paths exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope (architecture §5 steps 1-9), reusing the
 * EXISTING two-tenant factories + the EXISTING `audit_events` BYPASSRLS read helper
 * + the injectable `CommandClock` — NO new auth/error/audit mechanism.
 *
 * ── WHY THIS FILE IS `describe.skip` (RED PHASE) ─────────────────────────────────
 * The calc commands (`createCalculation`/`updateCalculation`/`archiveCalculation` +
 * the section/row families + the atomic `reorderRows`) and the
 * `calculation_data_model` migration + narrow atomic RPC do NOT exist yet — Task 1
 * (migration), Task 2 (RPC) and Task 3 (commands) are the Story 5.1 DEV phase. Until
 * they land, importing `@/server/commands/calculations/*` would not resolve, so this
 * scaffold:
 *   - keeps the suite `describe.skip` so it cannot fail CI before the feature exists
 *     (the project's red-phase idiom — Story 3.1 used the same), and
 *   - declares the command surface via a LOCAL `notYetImplemented()` placeholder that
 *     THROWS so a mistakenly un-skipped run fails LOUD rather than green-by-accident.
 *
 * ── GREEN-PHASE HAND-OFF (Story 5.1 dev) ────────────────────────────────────────
 * After Tasks 1-3 land:
 *   1. Replace the `notYetImplemented()` command stubs with real imports, e.g.
 *        import { createCalculation, updateCalculation, archiveCalculation,
 *          createSection, createRow, reorderRows } from "@/server/commands/calculations/…";
 *   2. Replace the `seedTenantACalc*` placeholders with the real Task-4.1 service-role
 *      seed helpers (`adminInsertCalculation`/`adminInsertSection`/`adminInsertRow`) and
 *      the `adminSelectCalcRowById` BYPASSRLS read helper.
 *   3. Remove `.skip`. The assertions below are the CONTRACT — do not weaken them.
 *
 * Every assertion encodes EXPECTED behavior (no `expect(true).toBe(true)`); the suite
 * is designed to FAIL until the commands + migration exist. Runs against the LOCAL
 * Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-5.md 5.1-INT-03/04/05; story AC2/AC6/AC7 / Task 3 / 5.3):
 *   - happy-path create calc/section/row → persisted row + EXACTLY ONE calc-lifecycle
 *     audit row (per-run unique correlationId; deterministic injected timestamp),
 *   - VALIDATION_FAILED for bad row_type / non-positive qty / empty unit / float-or-
 *     negative öre / missing VAT assumption / illegal lifecycle transition — raw value
 *     never echoed,
 *   - archive sets `archived_at` (soft-delete; independent BYPASSRLS read proves the row
 *     still exists — no hard delete),
 *   - atomic reorder rollback: a mid-transaction failure leaves NO partial order/rows.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-02T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/**
 * RED-PHASE placeholder for the not-yet-built calc commands. The dev phase DELETES
 * this and imports the real `@/server/commands/calculations/*` handles (see header).
 * It throws so a mistakenly un-skipped run fails LOUD rather than green-by-accident.
 */
function notYetImplemented(): never {
  throw new Error(
    "Story 5.1 RED PHASE: the calc commands are not implemented yet. " +
      "Replace this with the real import from @/server/commands/calculations/* in the dev phase.",
  );
}

/**
 * RED-PHASE placeholder for the Task-4.1 service-role seed helper that creates a REAL
 * own-tenant calc + section + rows (so a create-row / archive / reorder test has a
 * concrete parent). TYPED as its green-phase shape so destructuring type-checks today,
 * but THROWS at call time so a mistakenly un-skipped run fails LOUD. The dev phase
 * replaces this with `adminInsertCalculation`/`adminInsertSection`/`adminInsertRow`.
 */
interface SeededCalc {
  readonly customerId: string;
  readonly calcId: string;
  readonly sectionId: string;
  readonly rowIds: readonly string[];
}
function seedTenantACalcWithSection(): SeededCalc {
  throw new Error(
    "Story 5.1 RED PHASE: adminInsertCalculation/adminInsertSection/adminInsertRow not implemented yet.",
  );
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
  if (stackUp && fixture) await cleanupFixture(fixture);
});

// SKIPPED until the calc commands + migration + RPC land (Story 5.1 dev Tasks 1-3).
describe.skip("Calc commands via the envelope (AC2/AC6/AC7 / 5.1-INT-03/04/05)", () => {
  it("[P1] createCalculation persists the row and writes EXACTLY ONE audit_events row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createCalculation = notYetImplemented();
    const { customerId } = seedTenantACalcWithSection();
    const correlationId = crypto.randomUUID(); // append-only audit → unique per run

    const result = await runCommand(createCalculation, {
      client: a as never,
      input: { customer_id: customerId, title: "Ombyggnad kontor" },
      clock: fixedClock,
      correlationId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const calcId = (result.data as { targetId: string }).targetId;

    // EXACTLY ONE calc-lifecycle audit row; created_at == the single injected instant.
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.tenant_id).toBe(fixture.tenantA.id); // resolved tenant, NOT a client tenant_id
    expect(row.actor_user_id).toBe(fixture.adminA.id);
    expect(row.target_type).toBe("calculation");
    expect(row.target_id).toBe(calcId);
    expect(new Date(row.created_at).toISOString()).toBe(FIXED_ISO);

    // Audit metadata carries NO PII / money / customer values (SAFE_FIELDS allow-list).
    const serialized = JSON.stringify(row.metadata ?? {});
    expect(serialized.includes("Ombyggnad kontor")).toBe(false);
  });

  it("[P1] createSection + createRow persist under the correct parent with sort_order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();

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
  });

  it("[P0] VALIDATION_FAILED for a row_type outside the closed 5-value union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED for a non-positive quantity", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED for a negative öre money value", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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
    const createRow = notYetImplemented();
    const { sectionId } = seedTenantACalcWithSection();
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

  it("[P0] VALIDATION_FAILED for an illegal lifecycle transition on updateCalculation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const updateCalculation = notYetImplemented();
    const { calcId } = seedTenantACalcWithSection();
    // e.g. archived → draft is not a legal transition (the state machine rejects it).
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
    const archiveCalculation = notYetImplemented();
    const { calcId } = seedTenantACalcWithSection();

    const archived = await runCommand(archiveCalculation, {
      client: a as never,
      input: { id: calcId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);

    // Independent BYPASSRLS read proves the row still EXISTS with archived_at set —
    // a soft-delete, never a hard DELETE. archived_at == the single injected instant.
    const row = await adminQuery<{ archived_at: string | null }>(
      `select archived_at from public.calculations where id = $1`,
      [calcId],
    );
    expect(row.length).toBe(1);
    expect(row[0].archived_at).not.toBeNull();
    expect(new Date(row[0].archived_at as string).toISOString()).toBe(FIXED_ISO);
  });

  it("[P0/AC6] an atomic reorder that fails mid-transaction rolls back FULLY — no partial order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const reorderRows = notYetImplemented();
    const { sectionId, rowIds } = seedTenantACalcWithSection();

    // Capture the pre-reorder ordering, then submit a reorder whose LAST item is invalid
    // (an id that does not belong to the section) so the narrow RPC's transaction aborts.
    const before = await adminQuery<{ id: string; sort_order: number }>(
      `select id, sort_order from public.calculation_rows
         where section_id = $1 order by sort_order`,
      [sectionId],
    );

    const result = await runCommand(reorderRows, {
      client: a as never,
      input: {
        section_id: sectionId,
        // a valid reshuffle of the first ids + one bogus id last → the whole txn aborts
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
});
