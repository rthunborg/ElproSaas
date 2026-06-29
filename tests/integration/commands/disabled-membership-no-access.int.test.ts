/**
 * GAP G-1 (P1, the gate-flipper) — DB-BACKED disabled/inactive-membership → no-access.
 *
 * The consolidated epic-2 foundation test design (`test-design-epic-2-foundation-
 * consolidated.md`, P1-2 / R-004 / Gap G-1) flagged that the distinct
 * `disabled`/`invited` → TENANT_MEMBERSHIP_REQUIRED decision was proven ONLY at the
 * pure-unit level: NO live fixture exercised a real disabled/invited membership row
 * against a real DB resolve/envelope run. This file closes that gap with the minimal
 * `seedMembership` fixture capability (added to `tests/factories/tenants.ts`) and a
 * LIVE-stack assertion at BOTH layers:
 *
 *   1. the `resolveTenantContext` authority — a live `disabled`/`invited` membership
 *      row resolves to TENANT_MEMBERSHIP_REQUIRED (no-access), and
 *   2. the command envelope — the same caller is rejected at the membership gate with
 *      NO audit row written.
 *
 * It is the inactive-membership analogue of the no-membership orphan case already
 * covered (`resolve-tenant-context.int.test.ts` AC2 / `envelope-failure-modes.int.test.ts`
 * TENANT_MEMBERSHIP_REQUIRED): the orphan has NO row; here a row EXISTS but is not
 * `active`, and MUST still be no-access — proving the resolver keys on `status =
 * 'active'`, not on row existence.
 *
 * RED-PHASE NOTE: the behavior already exists (the resolver's active-only filter), so
 * this is a coverage-CLOSING test that is GREEN immediately on the current stack —
 * exactly the ATDD case "asserts behavior that already exists ⇒ may be green" — and it
 * is what promotes P1-2 PARTIAL → FULL (epic P1 80% → 90%, the deterministic gate flip
 * CONCERNS → PASS). Runs against the LOCAL Supabase stack only; skips when unreachable.
 *
 * COVERAGE: test-design-epic-2-foundation-consolidated.md Gap G-1; P1-2; R-004.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  seedMembership,
  cleanupFixture,
  NON_ACTIVE_MEMBERSHIP_STATUSES,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { defineCommand, runCommand } from "@/server/commands/envelope";
import { adminCountAuditEvents } from "../../factories/audit-events";
import type { CommandClock } from "@/server/commands/clock";

// Adapt the supabase-js factory client to the resolver's structural client type
// (it only uses `.auth.getClaims()` + `.from(...)`), matching the existing INT suite.
type ResolverClient = Parameters<typeof resolveTenantContext>[0] extends infer O
  ? O extends { client?: infer C }
    ? C
    : never
  : never;

const fixedClock: CommandClock = {
  now: () => new Date("2026-06-29T12:00:00.000Z"),
};

let stackUp = false;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

/** A minimal auditable command — used to prove the membership gate rejects BEFORE audit. */
function makeNoopCommand() {
  return defineCommand<{ note: string }, { targetId: string; note: string }>({
    command: "tenant.noop",
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

describe("Disabled/inactive membership → no-access (Gap G-1 / P1-2 / R-004)", () => {
  // Data-driven over EVERY non-active status the schema CHECK admits, so a future
  // status that should also deny (or a regression that lets one through) is caught.
  for (const status of NON_ACTIVE_MEMBERSHIP_STATUSES) {
    describe(`status: ${status}`, () => {
      let fixture: TwoTenantFixture;

      beforeAll(async () => {
        if (!stackUp) return;
        // Fresh fixture per status so the seeded inactive membership never perturbs
        // another case (and the active admins stay clean).
        fixture = await createTwoTenantFixture();
        // Seed the orphan as a NON-active tenant_admin of Tenant A — a LIVE row that
        // exists but does not grant access. THIS is what makes G-1 genuinely runnable
        // (not a vacuous skip): a real disabled/invited membership in the DB.
        await seedMembership({
          tenant: fixture.tenantA,
          user: fixture.orphanUser,
          status,
        });
      });

      afterAll(async () => {
        if (stackUp && fixture) await cleanupFixture(fixture);
      });

      it(`[P1] resolveTenantContext treats a live '${status}' membership as no-access (TENANT_MEMBERSHIP_REQUIRED, distinct from no-row)`, async () => {
        if (!stackUp) return;
        const client = (await makeAuthedServerClient(
          fixture.orphanUser,
        )) as unknown as ResolverClient;
        const result = await resolveTenantContext({ client });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          // Same code as the no-membership orphan — but the row EXISTS here, proving
          // the resolver keys on status='active', not on row existence (R-004).
          expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
        }
      });

      it(`[P1] a '${status}' member reads ZERO tenant rows under RLS (active-only USING clause)`, async () => {
        if (!stackUp) return;
        // The active-only membership predicate also gates RLS row visibility: an
        // inactive member must not be able to read the tenant it is inactively
        // attached to. Asserts no-access by MECHANISM (zero rows under the caller's
        // own RLS scope), complementing the resolver-level decision above.
        const authed = await makeAuthedServerClient(fixture.orphanUser);
        const { data: tenants } = await authed.from("tenants").select("id");
        expect(tenants ?? []).toEqual([]);
        const { data: memberships } = await authed
          .from("tenant_memberships")
          .select("tenant_id");
        expect(memberships ?? []).toEqual([]);
      });

      it(`[P1] the command envelope rejects a '${status}' member at the membership gate and writes NO audit row`, async () => {
        if (!stackUp) return;
        const client = await makeAuthedServerClient(fixture.orphanUser);
        const before = await adminCountAuditEvents({
          tenantId: fixture.tenantA.id,
        });

        const result = await runCommand(makeNoopCommand(), {
          client: client as never,
          input: { note: "should-never-run" },
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("TENANT_MEMBERSHIP_REQUIRED");
        }
        // The gate fails BEFORE execute/audit — no row is written under Tenant A.
        const after = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
        expect(after).toBe(before);
      });
    });
  }
});
