/**
 * GAP G-6 (P2) — `audit_events.actor_user_id ON DELETE SET NULL` persistence.
 *
 * The consolidated foundation test design (`test-design-epic-2-foundation-
 * consolidated.md`, Gap G-6) flags that the most-documented audit design decision —
 * the audit row SURVIVES a deleted actor by NULLING the `actor_user_id` FK (migration
 * 20260629121136_audit_events.sql: `actor_user_id uuid references auth.users(id) on
 * delete set null`) — has ZERO test coverage.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 *  FINDING (surfaced by scaffolding this gap — see the RED-PHASE describe.skip below):
 *  The `ON DELETE SET NULL` action is DEFEATED by the append-only `BEFORE UPDATE OR
 *  DELETE` trigger (`audit_events_append_only` →
 *  `public.audit_events_block_mutation()`). The FK SET NULL is implemented as an
 *  internal UPDATE of the referencing row to null `actor_user_id`; the trigger raises
 *  on ANY update, so deleting an actor whose id appears in `audit_events` FAILS with
 *  SQLSTATE 23001 (`restrict_violation`) instead of nulling the column. The documented
 *  "audit row survives a deleted actor by nulling the FK" behavior therefore does NOT
 *  currently hold — actor deletion is blocked entirely whenever the actor has authored
 *  an audit row.
 *
 *  Two tests below:
 *   1. (RUNNABLE-GREEN) `pins the CURRENT actual behavior` — documents that actor
 *      deletion is presently blocked by the append-only trigger (SQLSTATE 23001). This
 *      executes today so the discrepancy is captured by a real, non-vacuous test.
 *   2. (GATED-SKIP, red phase) `nulls actor_user_id and preserves the row` — the
 *      INTENDED behavior. It is `describe.skip`-ed with a TODO; un-skip it once the
 *      append-only trigger is amended to PERMIT the FK-driven SET NULL of
 *      `actor_user_id` (e.g. allow an UPDATE that changes ONLY `actor_user_id` to NULL,
 *      while still blocking every other mutation). At that point test (1) flips and
 *      should be deleted/inverted.
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * Runs against the LOCAL stack only; skips when unreachable.
 *
 * COVERAGE: test-design-epic-2-foundation-consolidated.md Gap G-6; architecture §15, §9.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  cleanupFixture,
  deleteAuthUser,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import {
  adminInsertAuditEvent,
  adminSelectAuditEvents,
} from "../../factories/audit-events";
import { adminExec } from "../../factories/admin-sql";

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

describe("audit_events actor delete — CURRENT behavior (Gap G-6, finding)", () => {
  it("[P2] deleting an actor that authored an audit row is BLOCKED by the append-only trigger (SQLSTATE 23001) — the ON DELETE SET NULL is currently defeated", async () => {
    if (!stackUp) return;

    // Seed a Tenant A audit row attributed to adminA as actor.
    const correlationId = crypto.randomUUID();
    const auditId = await adminInsertAuditEvent({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.adminA.id,
      command: "actor.delete.probe",
      event_type: "actor.delete.probe",
      target_type: "tenant",
      target_id: fixture.tenantA.id,
      correlation_id: correlationId,
      metadata: { reason: "g6-seed" },
    });

    // Attempt the actor delete DIRECTLY (the GoTrue admin API masks the DB error as
    // an opaque {}; the raw delete surfaces the real SQLSTATE). The FK SET NULL action
    // tries to UPDATE the audit row → the append-only trigger raises 23001.
    let raised: { code?: string; message?: string } | null = null;
    try {
      await adminExec(`delete from auth.users where id = $1`, [
        fixture.adminA.id,
      ]);
    } catch (e) {
      raised = e as { code?: string; message?: string };
    }

    // CURRENT behavior: the delete is blocked by the append-only trigger.
    expect(raised).not.toBeNull();
    expect(raised?.code).toBe("23001"); // restrict_violation from the append-only guard

    // The audit row is therefore unchanged and the actor still attributed.
    const after = await adminSelectAuditEvents({ id: auditId });
    expect(after.length).toBe(1);
    expect(after[0].actor_user_id).toBe(fixture.adminA.id);
  });
});

// RED PHASE (gated). The INTENDED behavior per migration/architecture docs: deleting
// the actor should NULL `actor_user_id` and PRESERVE the append-only row. Currently
// impossible because the append-only BEFORE UPDATE trigger blocks the FK SET NULL
// (see the finding above + the runnable test that pins the current 23001 block).
//
// TODO(G-6): un-skip once the append-only enforcement is amended to allow the
// FK-driven SET NULL of ONLY `actor_user_id` (while still blocking all other
// UPDATE/DELETE). When that lands, the test above (23001 block) should be inverted.
describe.skip("audit_events actor_user_id ON DELETE SET NULL persistence — INTENDED (Gap G-6)", () => {
  it("[P2] deleting the actor nulls actor_user_id and preserves the append-only audit row (all other columns intact)", async () => {
    if (!stackUp) return;
    const correlationId = crypto.randomUUID();
    const auditId = await adminInsertAuditEvent({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.adminB.id,
      command: "actor.delete.intended",
      event_type: "actor.delete.intended",
      target_type: "tenant",
      target_id: fixture.tenantA.id,
      correlation_id: correlationId,
      metadata: { reason: "g6-intended" },
    });
    const before = await adminSelectAuditEvents({ id: auditId });
    expect(before[0].actor_user_id).toBe(fixture.adminB.id);

    await deleteAuthUser(fixture.adminB.id);

    const after = await adminSelectAuditEvents({ id: auditId });
    expect(after.length).toBe(1); // NOT cascade-deleted
    const row = after[0];
    expect(row.actor_user_id).toBeNull(); // FK action is SET NULL
    expect(row.command).toBe("actor.delete.intended");
    expect(row.event_type).toBe("actor.delete.intended");
    expect(row.target_type).toBe("tenant");
    expect(row.target_id).toBe(fixture.tenantA.id);
    expect(row.correlation_id).toBe(correlationId);
    expect(row.metadata).toEqual({ reason: "g6-intended" });
    expect(new Date(row.created_at).toISOString()).toBe(
      new Date(before[0].created_at).toISOString(),
    );
  });
});
