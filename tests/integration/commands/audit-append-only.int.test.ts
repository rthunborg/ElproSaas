/**
 * Story 2.3 — DB-BACKED append-only acceptance for `audit_events` (AC4 / R-009): the
 * app path (authenticated anon-key) CANNOT UPDATE or DELETE an audit row, and an
 * independent privileged re-read proves the row is unchanged. Follows the Story 2.2
 * review hardening: assert the DENIAL MECHANISM (non-null error + the 42501 permission
 * code where the missing GRANT bites, and/or the append-only trigger exception), NEVER
 * a vacuous `error !== null || zero-rows` disjunction. Runs LOCAL stack only.
 *
 * GREEN as of Story 2.3 dev-story (migration + table + audit-events factory landed).
 *
 * COVERAGE (test-design-epic-2.md P1, "audit_events append-only" + R-009;
 * story AC4; Task 1.4 / 5.3a).
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
import {
  adminInsertAuditEvent,
  adminSelectAuditEvents,
} from "../../factories/audit-events";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let seededAuditId: string;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed a real Tenant A audit row via the privileged path so the app-path
  // UPDATE/DELETE has a concrete target to be denied against.
  seededAuditId = await adminInsertAuditEvent({
    tenant_id: fixture.tenantA.id,
    actor_user_id: fixture.adminA.id,
    command: "seed.command",
    event_type: "seed.event",
    target_type: "tenant",
    target_id: fixture.tenantA.id,
    correlation_id: crypto.randomUUID(),
    metadata: { reason: "seed" },
  });
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("audit_events is append-only through the app path (AC4 / R-009)", () => {
  it("[P1] UPDATE: Tenant A's own admin CANNOT update an existing audit row (no UPDATE grant / append-only trigger)", async () => {
    if (!stackUp) return;
    const { data: affected, error } = await a
      .from("audit_events")
      .update({ metadata: { tampered: true } })
      .eq("id", seededAuditId)
      .select();

    // Assert the MECHANISM, not a vacuous empty set: `authenticated` has NO UPDATE
    // grant (and/or a BEFORE UPDATE trigger raises). A future regression GRANTing
    // UPDATE against a zero-matching USING clause would still produce an empty set
    // and must NOT pass here.
    expect(error).not.toBeNull();
    expect(affected).toBeNull();
  });

  it("[P1] DELETE: Tenant A's own admin CANNOT delete an existing audit row", async () => {
    if (!stackUp) return;
    const { data: deleted, error } = await a
      .from("audit_events")
      .delete()
      .eq("id", seededAuditId)
      .select();

    expect(error).not.toBeNull();
    expect(deleted).toBeNull();
  });

  it("[P1] the seeded audit row is UNCHANGED after the denied UPDATE/DELETE (independent privileged re-read)", async () => {
    if (!stackUp) return;
    // Re-read via the BYPASSRLS privileged path (independent of the app path) to
    // prove no mutation slipped through — never trust the denied call's own result.
    const rows = await adminSelectAuditEvents({ id: seededAuditId });
    expect(rows.length).toBe(1);
    expect(rows[0].metadata).toEqual({ reason: "seed" }); // not "{ tampered: true }"
    expect(rows[0].command).toBe("seed.command");
  });

  it("[P1] even the privileged service-role path has NO UPDATE/DELETE on audit_events (append-only at the privilege layer)", async () => {
    if (!stackUp) return;
    // Story 1.3 grants service_role SELECT,INSERT ONLY (no UPDATE/DELETE), and the
    // BEFORE UPDATE OR DELETE trigger raises for defense-in-depth. The TEST-ONLY
    // helper attempts a privileged UPDATE and must throw.
    await expect(
      adminInsertAuditEvent.tryUpdate?.(seededAuditId, { command: "rewritten" }),
    ).rejects.toBeTruthy();

    const rows = await adminSelectAuditEvents({ id: seededAuditId });
    expect(rows[0].command).toBe("seed.command"); // still unchanged
  });
});
