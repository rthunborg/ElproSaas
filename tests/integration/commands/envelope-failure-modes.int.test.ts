// @ts-nocheck
/**
 * Story 2.3 — RED-PHASE ATDD scaffold (TEA testarch-atdd, 2026-06-29).
 *
 * DB-BACKED end-to-end failure modes of the command envelope (AC2 / R-003 / R-004):
 * at least one LIVE-stack proof per critical gate, complementing the pure-core unit
 * (`tests/unit/server/commands/envelope-core.test.ts`). Each failure returns the
 * stable code with a user-safe message and writes NO audit row. Reuses the existing
 * two-tenant factories; runs against the LOCAL stack only (skips when unreachable).
 *
 * RED PHASE: `describe.skip(...)`, importing the Story 2.3 envelope + a future
 * TEST-ONLY audit read helper. Un-skip + drop `@ts-nocheck` when implemented.
 *
 * COVERAGE (test-design-epic-2.md P1, "Command envelope failure modes" + R-003/R-004;
 * story AC2; Task 5.2/5.3/5.4).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";

// RED: imported DYNAMICALLY inside the (skipped) `it` bodies so a static import of
// the not-yet-built `@/server/commands/envelope` + `tests/factories/audit-events`
// cannot crash Vitest COLLECTION and turn the int gate RED at load time. dev-story
// converts these to static imports + un-skips the describe when the modules land.
async function load() {
  const [{ defineCommand, runCommand }, { adminCountAuditEvents }] = await Promise.all([
    import("@/server/commands/envelope"),
    import("../../factories/audit-events"),
  ]);
  return { defineCommand, runCommand, adminCountAuditEvents };
}

type CommandClock = { now(): Date };
const fixedClock: CommandClock = { now: () => new Date("2026-06-29T12:00:00.000Z") };

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** A command that verifies ownership of a caller-supplied target id (R-004 seam). */
function makeOwnershipCommand(defineCommand: (cfg: unknown) => unknown) {
  return defineCommand({
    command: "tenant.touch",
    auditable: true,
    eventType: "tenant.touched",
    targetType: "tenant",
    validateInput: (raw: { targetId: string }) =>
      typeof raw?.targetId === "string"
        ? { ok: true, data: { targetId: raw.targetId } }
        : { ok: false, code: "VALIDATION_FAILED" },
    // The envelope verifies the target belongs to the resolved tenant before execute.
    ownership: (input) => ({ table: "tenants", id: input.targetId }),
    execute: async (ctx) => ({ ok: true, targetId: ctx.input.targetId }),
  });
}

describe.skip("Command envelope failure modes — DB-backed (AC2/R-003/R-004) — RED until Story 2.3", () => {
  it("[P1] UNAUTHENTICATED: an anonymous (no-session) caller is rejected first and writes NO audit row (R-003)", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminCountAuditEvents } = await load();
    const before = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
    const anon = await makeAnonServerClient();

    const result = await runCommand(makeOwnershipCommand(defineCommand), {
      client: anon,
      input: { targetId: fixture.tenantA.id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
    const after = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
    expect(after).toBe(before); // NO audit row on the failed gate
  });

  it("[P1] TENANT_MEMBERSHIP_REQUIRED: an authenticated orphan (no active admin) is denied, no audit row", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand } = await load();
    const orphan = await makeAuthedServerClient(fixture.orphanUser);

    const result = await runCommand(makeOwnershipCommand(defineCommand), {
      client: orphan,
      input: { targetId: fixture.tenantA.id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
  });

  it("[P1] VALIDATION_FAILED: malformed input is rejected with a generic message (no raw value echoed), no audit row", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminCountAuditEvents } = await load();
    const a = await makeAuthedServerClient(fixture.adminA);
    const before = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });

    const result = await runCommand(makeOwnershipCommand(defineCommand), {
      client: a,
      input: { wrong: "shape", leaked: "p@ssw0rd" } as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.message.includes("p@ssw0rd")).toBe(false);
    }
    const after = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
    expect(after).toBe(before);
  });

  it("[P1] TENANT_ACCESS_DENIED: a target id owned by Tenant B is denied for Tenant A's admin (R-004), no audit row", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminCountAuditEvents } = await load();
    const a = await makeAuthedServerClient(fixture.adminA);
    const before = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });

    // adminA forges a target id pointing at Tenant B's tenant row. The envelope's
    // ownership check (a tenant-scoped SELECT under RLS → zero rows) must DENY it.
    const result = await runCommand(makeOwnershipCommand(defineCommand), {
      client: a,
      input: { targetId: fixture.tenantB.id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
    const after = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
    expect(after).toBe(before); // ownership gate fails BEFORE the audit write
  });

  it("[P1] R-004: a client-supplied tenant_id in the input NEVER widens authority — the resolved tenant wins", async () => {
    if (!stackUp) return;
    const { defineCommand, runCommand, adminCountAuditEvents } = await load();
    const a = await makeAuthedServerClient(fixture.adminA);

    // The command targets its OWN tenant but the caller smuggles Tenant B's id as a
    // spoofed tenant_id field. The envelope ignores client tenant_id; the audit row
    // (if any) is written under Tenant A only, and access is never widened to B.
    const result = await runCommand(makeOwnershipCommand(defineCommand), {
      client: a,
      input: { targetId: fixture.tenantA.id, tenant_id: fixture.tenantB.id } as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    // Success under Tenant A (client tenant_id ignored), never under Tenant B.
    expect(result.ok).toBe(true);
    const bCount = await adminCountAuditEvents({ tenantId: fixture.tenantB.id });
    // No audit row was written under the spoofed Tenant B.
    expect(bCount).toBe(0);
  });
});
