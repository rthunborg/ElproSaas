// @ts-nocheck
/**
 * Story 2.3 — RED-PHASE ATDD scaffold (TEA testarch-atdd, 2026-06-29).
 *
 * DB-BACKED happy-path acceptance: the canonical command-envelope SUCCESS plus a
 * field-by-field assertion of the written `audit_events` row (AC1 / AC3 / AC6).
 * Runs against the LOCAL Supabase stack only (skips when unreachable), mirroring
 * the established Vitest INT suites and reusing the EXISTING two-tenant factories
 * (`createTwoTenantFixture` / `makeAuthedServerClient`) — no new fixtures.
 *
 * RED PHASE: the whole suite is `describe.skip(...)`. It imports
 * `@/server/commands/envelope` + `@/server/commands/clock` (authored by Story 2.3
 * dev-story) and a future additive factory helper `adminInsertAuditEvent` /
 * `adminSelectAuditEvents`. Un-skip + drop `@ts-nocheck` when the modules exist.
 *
 * COVERAGE (test-design-epic-2.md P1, "Command envelope full happy path (2.3 AC1)" +
 * "Successful audit write records … (2.3 AC2/AC3)"; story AC1/AC3/AC6; Task 5.2).
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

// RED: these modules are authored by Story 2.3 dev-story. They are imported
// DYNAMICALLY inside the (skipped) `it` bodies — a STATIC import would crash
// Vitest module COLLECTION before `describe.skip` can skip the suite, turning the
// whole `pnpm test:int` gate RED at load time. The skipped `it` callbacks never
// run, so these dynamic imports never fire while RED. When dev-story lands:
//   - @/server/commands/envelope        (defineCommand / runCommand)
//   - @/server/commands/clock           (CommandClock)
//   - tests/factories/audit-events      (adminSelectAuditEvents — additive helper)
// convert these back to static imports, un-skip the describe, drop `@ts-nocheck`.
async function load() {
  const [{ defineCommand, runCommand }, { adminSelectAuditEvents }] = await Promise.all([
    import("@/server/commands/envelope"),
    import("../../factories/audit-events"),
  ]);
  return { defineCommand, runCommand, adminSelectAuditEvents };
}

type CommandClock = { now(): Date };
const FIXED_ISO = "2026-06-29T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

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
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("Command envelope happy path + audit fields (AC1/AC3/AC6) — RED until Story 2.3", () => {
  /**
   * A minimal auditable command targeting the resolved tenant itself (no business
   * table exists yet this story). It proves the full §5 path:
   * resolve → membership → validate → own → execute → audit → typed ok.
   */
  function makeNoopCommand(defineCommand: (cfg: unknown) => unknown) {
    return defineCommand({
      command: "tenant.noop",
      auditable: true,
      eventType: "tenant.noop.executed",
      targetType: "tenant",
      validateInput: (raw: { note: string }) =>
        typeof raw?.note === "string"
          ? { ok: true, data: { note: raw.note } }
          : { ok: false, code: "VALIDATION_FAILED" },
      execute: async (ctx) => ({ targetId: ctx.tenantContext.tenantId, note: ctx.input.note }),
    });
  }

  it("[P1] resolves user→membership→validation→ownership→audit and returns typed ok (AC1)", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand } = await load();
    const command = makeNoopCommand(defineCommand);

    const result = await runCommand(command, {
      client: a,
      input: { note: "ok" },
      clock: fixedClock,
      correlationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetId).toBe(fixture.tenantA.id);
      expect(result.data.note).toBe("ok");
    }
  });

  it("[P1] writes EXACTLY ONE audit_events row with every snake_case column correct (AC3)", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminSelectAuditEvents } = await load();
    const command = makeNoopCommand(defineCommand);
    const correlationId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    await runCommand(command, {
      client: a,
      input: { note: "audit-me" },
      clock: fixedClock,
      correlationId,
    });

    // Introspect via the privileged TEST-ONLY read (BYPASSRLS) to assert the stored row.
    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows.length).toBe(1);
    const row = rows[0];

    // Field-by-field, by EXACT snake_case column (architecture §15).
    expect(row.tenant_id).toBe(fixture.tenantA.id); // resolved tenant
    expect(row.actor_user_id).toBe(fixture.adminA.id); // authenticated user
    expect(row.command).toBe("tenant.noop");
    expect(row.event_type).toBe("tenant.noop.executed");
    expect(row.target_type).toBe("tenant");
    expect(row.target_id).toBe(fixture.tenantA.id);
    expect(row.correlation_id).toBe(correlationId);
    // AC6: created_at equals the single injected command timestamp, no drift.
    expect(new Date(row.created_at).toISOString()).toBe(FIXED_ISO);
    // metadata is the sanitized narrow object (never raw input pass-through).
    expect(typeof row.metadata).toBe("object");
  });

  it("[P1] the audit metadata stored on the happy path contains NO forbidden content (AC5/R-010 end-to-end)", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminSelectAuditEvents } = await load();
    const command = makeNoopCommand(defineCommand);
    const correlationId = "11111111-2222-3333-4444-555555555555";

    await runCommand(command, {
      client: a,
      // a caller tries to smuggle a secret through input → must never reach metadata.
      input: { note: "ok", apiKey: "sk_live_should_not_persist" } as never,
      clock: fixedClock,
      correlationId,
    });

    const rows = await adminSelectAuditEvents({ correlationId });
    const serialized = JSON.stringify(rows[0]?.metadata ?? {});
    expect(serialized.includes("sk_live_should_not_persist")).toBe(false);
  });
});
