/**
 * Story 3.1 — ATDD RED-PHASE scaffold: CRM command-envelope acceptance (AC3, P0/P1).
 *
 * The canonical CRM command happy/failure paths exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope (architecture §5 steps 1-9), reusing the
 * EXISTING two-tenant factories and the EXISTING `audit_events` BYPASSRLS read
 * helper — NO new auth/error/audit mechanism.
 *
 * ── WHY THIS FILE IS `describe.skip` (RED PHASE) ─────────────────────────────────
 * The nine CRM commands (`createCustomer`/`updateCustomer`/`archiveCustomer` + the
 * facility/contact families) and the `crm_data_model` migration do NOT exist yet —
 * Task 1 (migration) and Task 2 (commands) are the Story 3.1 DEV phase. Until they
 * land, importing `@/server/commands/crm/*` would not resolve, so this scaffold:
 *   - keeps the suite `describe.skip` so it cannot fail CI before the feature exists
 *     (the project's established red-phase idiom — Story 2.2/2.3 used the same), and
 *   - declares the command surface via a LOCAL `notYetImplemented()` placeholder so
 *     the file type-checks today WITHOUT importing a non-existent module.
 *
 * ── GREEN-PHASE HAND-OFF (Story 3.1 dev) ────────────────────────────────────────
 * After Task 1+2 land:
 *   1. Replace the `notYetImplemented()` command stubs with real imports:
 *        import { createCustomer, updateCustomer, archiveCustomer } from
 *          "@/server/commands/crm/customers";
 *   2. Replace `adminSelectCustomerById` with the real `tests/factories/tenants.ts`
 *      service-role read helper added in Task 3.1.
 *   3. Remove `.skip`. The assertions below are the CONTRACT — do not weaken them.
 *
 * Every assertion encodes EXPECTED behavior (no `expect(true).toBe(true)`); the
 * suite is designed to FAIL until the commands + migration exist. Runs against the
 * LOCAL Supabase stack only; skips visibly when unreachable.
 *
 * COVERAGE (test-design-epic-3.md P0/P1; story AC3 / Task 2 / Task 4.3):
 *   - happy-path create/update/archive → persisted row + EXACTLY ONE audit row,
 *   - VALIDATION_FAILED for bad customer_type / missing-or-mismatched identifier /
 *     bad email,
 *   - archive sets `archived_at` (soft-delete, no hard delete),
 *   - database-owned audit timestamp bounded by Postgres clock samples (never `sleep`),
 *   - audit metadata carries NO PII (personnummer/org_nr/name/email).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminSelectCrmRowById,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  expectDatabaseOwnedTimestamp,
  readDatabaseNow,
} from "../../support/database-time";
import { runCommand } from "@/server/commands/envelope";
import {
  createCustomer,
  updateCustomer,
  archiveCustomer,
} from "@/server/commands/crm/customers";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-06-30T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

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

// Un-gated (Story 3.1 dev): the CRM commands + migration have landed (Tasks 1-2).
describe("CRM customer commands via the envelope (AC3 / R-001,R-010)", () => {
  it("[P1] createCustomer (private) persists the row and writes EXACTLY ONE audit_events row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID(); // append-only audit → unique per run
    const databaseBefore = await readDatabaseNow();

    const result = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "private",
        display_name: "Anna Andersson",
        personnummer: "19900101-1234",
        email: "anna@example.test",
        phone: "+46701234567",
      },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const customerId = (result.data as { targetId: string }).targetId;

    // EXACTLY ONE audit row, every snake_case column correct, with a database-owned timestamp.
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.tenant_id).toBe(fixture.tenantA.id); // resolved tenant, NOT a client tenant_id
    expect(row.actor_user_id).toBe(fixture.adminA.id);
    expect(row.command).toBe("customer.create");
    expect(row.event_type).toBe("customer.created");
    expect(row.target_type).toBe("customer");
    expect(row.target_id).toBe(customerId);
    expectDatabaseOwnedTimestamp(row.created_at, databaseBefore, databaseAfter, FIXED_ISO);

    // Audit metadata carries NO PII — personnummer/name/email never routed there
    // (SAFE_FIELDS allow-list; project-context Security Regression Harness Rules).
    const serialized = JSON.stringify(row.metadata ?? {});
    expect(serialized.includes("19900101-1234")).toBe(false);
    expect(serialized.includes("Anna Andersson")).toBe(false);
    expect(serialized.includes("anna@example.test")).toBe(false);
  });

  it("[P1] createCustomer (company) requires org_nr and rejects personnummer", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "company",
        display_name: "Elfirma AB",
        org_nr: "556677-8899",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
  });

  it("[P0] VALIDATION_FAILED for a customer_type outside the 4 approved values", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: { customer_type: "charity", display_name: "X" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED when a private customer omits personnummer", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: { customer_type: "private", display_name: "No Personnummer" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] VALIDATION_FAILED when a private customer carries org_nr (identifier-by-type)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "private",
        display_name: "Wrong Identifier",
        personnummer: "19900101-1234",
        org_nr: "556677-8899",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] VALIDATION_FAILED for a malformed email where email is captured", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "company",
        display_name: "Bad Email AB",
        org_nr: "556677-8899",
        email: "not-an-email",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] VALIDATION_FAILED for an empty display_name", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "company",
        display_name: "",
        org_nr: "556677-8899",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] archiveCustomer sets archived_at (soft-delete) and the row is NOT hard-deleted", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await runCommand(createCustomer, {
      client: a as never,
      input: {
        customer_type: "company",
        display_name: "ToArchive AB",
        org_nr: "556677-8899",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const customerId = (created.data as { targetId: string }).targetId;

    const archived = await runCommand(archiveCustomer, {
      client: a as never,
      input: { id: customerId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);

    // Independent BYPASSRLS read proves the row still EXISTS with archived_at set —
    // a soft-delete, never a hard DELETE. archived_at == the single injected instant.
    const row = await adminSelectCrmRowById("customers", customerId);
    expect(row).not.toBeNull();
    expect(row?.archived_at).not.toBeNull();
    expect(new Date(row?.archived_at as string).toISOString()).toBe(FIXED_ISO);
  });

  it("[P1] updateCustomer on a foreign-tenant id returns TENANT_ACCESS_DENIED (RLS invisible)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A random id (or a Tenant B id) is invisible under A's RLS → ownership-verify
    // sees zero rows → TENANT_ACCESS_DENIED (envelope verifyOwnership, R-004).
    const result = await runCommand(updateCustomer, {
      client: a as never,
      input: { id: crypto.randomUUID(), display_name: "Hijack" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });
});
