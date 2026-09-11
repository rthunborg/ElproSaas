/**
 * Story 2.3 — DB-BACKED happy-path acceptance: the canonical command-envelope
 * SUCCESS plus a field-by-field assertion of the written `audit_events` row
 * (AC1 / AC3 / AC6). Runs against the LOCAL Supabase stack only (skips when
 * unreachable), mirroring the established Vitest INT suites and reusing the EXISTING
 * two-tenant factories (`createTwoTenantFixture` / `makeAuthedServerClient`) — no
 * new fixtures.
 *
 * GREEN as of Story 2.3 dev-story (envelope + clock + audit-events factory landed).
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
import { skipUnlessStack } from "../../support/stack-gate";
import { defineCommand, runCommand } from "@/server/commands/envelope";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import {
  expectDatabaseOwnedTimestamp,
  readDatabaseNow,
} from "../../support/database-time";
import type { CommandClock } from "@/server/commands/clock";

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

/**
 * A minimal auditable command targeting the resolved tenant itself (no business
 * table exists yet this story). It proves the full §5 path:
 * resolve → membership → validate → own → execute → audit → typed ok.
 */
function makeNoopCommand() {
  return defineCommand<{ note: string }, { targetId: string; note: string }>({
    command: "tenant.noop",
    capability: { module: "foundation", capability: "Memberships.Manage" },
    auditable: true,
    eventType: "tenant.noop.executed",
    targetType: "tenant",
    validateInput: (raw) => {
      const note = (raw as { note?: unknown } | null)?.note;
      return typeof note === "string"
        ? { ok: true, data: { note } }
        : { ok: false, code: "VALIDATION_FAILED" };
    },
    execute: async (ctx) => ({
      targetId: ctx.tenantContext.tenantId,
      note: ctx.input.note,
    }),
  });
}

describe("Command envelope happy path + audit fields (AC1/AC3/AC6)", () => {
  it("[P1] resolves user→membership→validation→ownership→audit and returns typed ok (AC1)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const command = makeNoopCommand();
    const correlationId = crypto.randomUUID();

    const result = await runCommand(command, {
      client: a as never,
      input: { note: "ok" },
      clock: fixedClock,
      correlationId,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targetId).toBe(fixture.tenantA.id);
      expect(result.data.note).toBe("ok");
    }
  });

  it("[P1] writes EXACTLY ONE audit_events row with every snake_case column correct (AC3)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const command = makeNoopCommand();
    // Per-run unique id: audit_events is append-only (no fixture cleanup), so a
    // hardcoded correlation_id accumulates rows across repeated non-reset runs and
    // breaks the exact `toBe(1)` count below. A fresh UUID scopes the query to THIS run.
    const correlationId = crypto.randomUUID();
    const databaseBefore = await readDatabaseNow();

    await runCommand(command, {
      client: a as never,
      input: { note: "audit-me" },
      clock: fixedClock,
      correlationId,
    });
    const databaseAfter = await readDatabaseNow();

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
    // The shared audit boundary owns created_at; the caller's command clock cannot backdate it.
    expectDatabaseOwnedTimestamp(row.created_at, databaseBefore, databaseAfter, FIXED_ISO);
    // metadata is the sanitized narrow object (never raw input pass-through).
    expect(typeof row.metadata).toBe("object");
  });

  it("[P1] the audit metadata stored on the happy path contains NO forbidden content (AC5/R-010 end-to-end)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const command = makeNoopCommand();
    const correlationId = crypto.randomUUID();

    await runCommand(command, {
      client: a as never,
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
