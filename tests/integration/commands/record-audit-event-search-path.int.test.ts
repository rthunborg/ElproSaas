/**
 * Story 2.3 — DB-BACKED SECURITY DEFINER search-path-hijack negative for the audit
 * write RPC `record_audit_event` (R-006). Story 2.3 chose the DEFINER write path
 * (Task 4.1 option (i), the architecture-blessed pattern). Proves a malicious object
 * on a tampered `search_path` cannot alter the function's behaviour because it pins
 * `set search_path = ''` and schema-qualifies every reference; includes the CONTROL
 * case (a real session through the function returns the expected result). Mirrors
 * `security-definer-search-path.rls.test.ts` and reuses the `adminSession` helper
 * (which `discard all`s before release — Story 2.2 fix). LOCAL stack only.
 *
 * GREEN as of Story 2.3 dev-story (record_audit_event DEFINER fn landed).
 *
 * COVERAGE (test-design-epic-2.md R-006; story Task 4.2 / 5.5).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  cleanupFixture,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminExec, adminSession, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp) {
    await adminExec("drop schema if exists evil_audit cascade;").catch(() => {});
    if (fixture) await cleanupFixture(fixture);
    await closeAdminPool();
  }
});

describe("record_audit_event resists search_path hijack (R-006)", () => {
  it("[P1] a hostile is_active_tenant_member shadow on a tampered search_path CANNOT make an orphan's audit write succeed", async () => {
    if (!stackUp) return;

    const result = await adminSession(async ({ query }) => {
      // (1) auth.uid() := orphanUser (no real membership in Tenant B).
      await query(`select set_config('request.jwt.claim.sub', $1, false)`, [
        fixture.orphanUser.id,
      ]);

      // (2) Plant a hostile schema with a function that would ALWAYS return true,
      //     shadowing the real public.is_active_tenant_member if resolved unqualified.
      await query(`create schema if not exists evil_audit;`);
      await query(
        `create or replace function evil_audit.is_active_tenant_member(uuid)
           returns boolean language sql as $$ select true $$;`,
      );

      // (3) Tamper the session search_path so an UNQUALIFIED reference would hit evil first.
      await query(`set search_path = evil_audit, public;`);

      // (4) record_audit_event pins search_path='' and schema-qualifies its membership
      //     check, so for the orphan (no real membership in Tenant B) it must RAISE,
      //     never insert. Assert the call is rejected.
      let raised = false;
      try {
        await query(
          `select public.record_audit_event(
             $1::uuid, $2::uuid, 'evil.write', 'evil.event', 'tenant', $1::uuid,
             $3::uuid, '{}'::jsonb, '2026-06-29T12:00:00.000Z'::timestamptz)`,
          [fixture.tenantB.id, fixture.orphanUser.id, crypto.randomUUID()],
        );
      } catch {
        raised = true;
      }
      return raised;
    });

    expect(result).toBe(true); // the membership check fired despite the hostile shadow
  });

  it("[CONTROL] a REAL active admin writing under their OWN tenant succeeds through the function", async () => {
    if (!stackUp) return;
    const ok = await adminSession(async ({ query }) => {
      await query(`select set_config('request.jwt.claim.sub', $1, false)`, [
        fixture.adminA.id,
      ]);
      await query(`set search_path = evil_audit, public;`);
      const rows = await query(
        `select public.record_audit_event(
           $1::uuid, $2::uuid, 'ctrl.write', 'ctrl.event', 'tenant', $1::uuid,
           $3::uuid, '{}'::jsonb, '2026-06-29T12:00:00.000Z'::timestamptz) as audit_id`,
        [fixture.tenantA.id, fixture.adminA.id, crypto.randomUUID()],
      );
      return rows[0]?.audit_id != null;
    });
    expect(ok).toBe(true); // proves the function is not trivially always-raising
  });
});
