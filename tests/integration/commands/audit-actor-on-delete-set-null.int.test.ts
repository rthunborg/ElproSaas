/**
 * GAP G-6 (P2) — `audit_events.actor_user_id ON DELETE SET NULL` persistence.
 *
 * The audit row must SURVIVE a deleted actor by NULLING the `actor_user_id` FK
 * (migration 20260629121136_audit_events.sql: `actor_user_id uuid references
 * auth.users(id) on delete set null`; architecture §15).
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 *  HISTORY: scaffolding this gap surfaced a defect — the FK `on delete set null` is
 *  implemented as an internal UPDATE of the referencing row, and the append-only
 *  `BEFORE UPDATE OR DELETE` trigger (`audit_events_append_only` →
 *  `public.audit_events_block_mutation()`) raised on ANY update, so deleting an actor
 *  who authored an audit row failed with SQLSTATE 23001 instead of nulling the column.
 *  FIXED in migration 20260629140000_audit_events_actor_null_exemption.sql, which
 *  narrows the guard to PERMIT exactly the FK action — an UPDATE whose SOLE change is
 *  `actor_user_id` non-null → NULL — while still blocking every other UPDATE and every
 *  DELETE (so the append-only / content-immutability invariant, architecture §9 /
 *  R-009, is intact; proven by `audit-append-only.int.test.ts` + the surgical-boundary
 *  test below).
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

describe("audit_events actor_user_id ON DELETE SET NULL persistence (Gap G-6)", () => {
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

    // Deleting the actor triggers the FK `on delete set null`; the narrowed
    // append-only guard now PERMITS that single referential action.
    await deleteAuthUser(fixture.adminB.id);

    const after = await adminSelectAuditEvents({ id: auditId });
    expect(after.length).toBe(1); // NOT cascade-deleted — the row survives
    const row = after[0];
    expect(row.actor_user_id).toBeNull(); // FK action is SET NULL — "actor since removed"
    // Every other column is unchanged: the row's content is immutable.
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

  it("[P2] the exemption is SURGICAL: a privileged UPDATE that nulls actor_user_id AND changes another column is STILL blocked (SQLSTATE 23001)", async () => {
    if (!stackUp) return;
    // The narrowing permits ONLY actor_user_id non-null → NULL with nothing else
    // changed. An UPDATE that also rewrites content must still hit the append-only
    // guard — otherwise nulling the actor would be a tampering escape hatch.
    const auditId = await adminInsertAuditEvent({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.adminA.id,
      command: "actor.null.tamper.probe",
      event_type: "actor.null.tamper.probe",
      target_type: "tenant",
      target_id: fixture.tenantA.id,
      correlation_id: crypto.randomUUID(),
      metadata: { reason: "g6-surgical" },
    });

    let raised: { code?: string } | null = null;
    try {
      // Null the actor AND tamper with metadata in one statement (privileged pool).
      await adminExec(
        `update public.audit_events
            set actor_user_id = null, metadata = '{"tampered":true}'::jsonb
          where id = $1`,
        [auditId],
      );
    } catch (e) {
      raised = e as { code?: string };
    }

    expect(raised).not.toBeNull();
    expect(raised?.code).toBe("23001"); // restrict_violation — append-only guard held

    // Independent privileged re-read: the row is untouched (actor still set, metadata intact).
    const rows = await adminSelectAuditEvents({ id: auditId });
    expect(rows.length).toBe(1);
    expect(rows[0].actor_user_id).toBe(fixture.adminA.id);
    expect(rows[0].metadata).toEqual({ reason: "g6-surgical" });
  });
});
