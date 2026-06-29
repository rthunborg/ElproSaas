/**
 * Story 2.3 — DB-BACKED anonymous-path isolation for `audit_events` + the
 * `record_audit_event` DEFINER RPC (AC2 / R-003). An anonymous (no-session) anon-key
 * caller cannot SELECT/INSERT audit rows, and `anon` has NO EXECUTE on the SECURITY
 * DEFINER `record_audit_event` write fn. Mirrors `anon-path-isolation.rls.test.ts`
 * and applies the Story 2.2 G2 fix: assert `error.code === "42501"`, NOT a vacuous
 * `data === false`. LOCAL stack only.
 *
 * GREEN as of Story 2.3 dev-story (migration + record_audit_event DEFINER landed).
 *
 * COVERAGE (test-design-epic-2.md P1, R-003; story AC2; Task 5.4).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAnonServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
let fixture: TwoTenantFixture;
let anon: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  anon = await makeAnonServerClient();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Anonymous path cannot touch audit_events or record_audit_event (AC2 / R-003)", () => {
  it("[P1] SELECT: an anonymous caller reads ZERO audit_events rows — denied at the privilege layer (no anon GRANT)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { data, error } = await anon.from("audit_events").select("*");
    // `anon` has NO SELECT grant (migration grants SELECT only to authenticated),
    // so the read is denied at the privilege layer (42501) — assert the MECHANISM,
    // not a vacuous non-null/empty disjunction (Story 2.2 hardening). [Review][Patch][Med]
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("[P1] INSERT: an anonymous caller CANNOT write an audit_events row (42501)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { data, error } = await anon
      .from("audit_events")
      .insert({
        tenant_id: fixture.tenantA.id,
        actor_user_id: fixture.adminA.id,
        command: "anon.spoof",
        event_type: "anon.spoof",
        target_type: "tenant",
        target_id: fixture.tenantA.id,
        correlation_id: crypto.randomUUID(),
        metadata: {},
      })
      .select();
    // `anon` has NO INSERT grant — denied at the privilege layer (42501). Assert the
    // MECHANISM, not a vacuous disjunction (Story 2.2 hardening). [Review][Patch][Med]
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("[P1] EXECUTE: an anonymous caller has NO EXECUTE on record_audit_event (assert 42501, not vacuous data===false)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // If Story 2.3 implements the SECURITY DEFINER `record_audit_event` RPC, it must
    // `REVOKE EXECUTE … FROM public` and grant only to `authenticated`. A failed
    // attempt to call it as anon must be denied at the privilege layer (42501) — NOT
    // a `false` result with no error (the Story 2.2 G2 lesson).
    const { data, error } = await anon.rpc("record_audit_event", {
      p_tenant_id: fixture.tenantA.id,
      p_actor_user_id: fixture.adminA.id,
      p_command: "anon.spoof",
      p_event_type: "anon.spoof",
      p_target_type: "tenant",
      p_target_id: fixture.tenantA.id,
      p_correlation_id: crypto.randomUUID(),
      p_metadata: {},
      p_created_at: "2026-06-29T12:00:00.000Z",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).not.toBe(true);
  });
});
