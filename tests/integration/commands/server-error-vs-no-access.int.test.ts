/**
 * GAP G-4 (P2, INT slice only) — SERVER_ERROR-vs-no-access taxonomy at the
 * integration level: a transient membership-read I/O error maps to SERVER_ERROR,
 * NOT to TENANT_MEMBERSHIP_REQUIRED / TENANT_ACCESS_DENIED.
 *
 * The consolidated foundation test design (`test-design-epic-2-foundation-
 * consolidated.md`, R-014 / Gap G-4) notes the taxonomy is proven in the PURE core
 * (`envelope-core-edges.test.ts`: transient throw → SERVER_ERROR; ownership error →
 * SERVER_ERROR not masked-as-denial) but is NOT exercised against the live DB-backed
 * resolve/envelope path. This file closes the ON-CURRENT-STACK (INT) slice of G-4:
 * it runs the REAL resolver/envelope against the live stack with a REAL authenticated
 * user (real `getClaims()` against the running auth server), then injects a transient
 * I/O fault into JUST the `tenant_memberships` read so the membership-read error path
 * (resolver step b1/b2 → SERVER_ERROR) and the envelope's outer try/catch are
 * genuinely executed end-to-end.
 *
 * The Playwright-BLOCKED half of G-4 — the `(app)` layout's own try/catch → user-safe
 * no-access RENDER on a thrown resolve — is NOT scaffolded here (it needs the browser
 * runner; see G-2/G-3 deferral notes).
 *
 * Why this is the FAITHFUL transient-fault proof and not a vacuous mock: the auth leg
 * is the real live JWT validation; only the membership SELECT is forced to return the
 * exact PostgREST `{ data: null, error }` shape a real outage (pool exhaustion / DB
 * down / RLS misconfig) produces — the precise input the resolver's `if (activeError)`
 * / `if (anyError)` branches were written to map to SERVER_ERROR. Asserting on the
 * LIVE-authenticated path proves the mapping survives the real resolve flow, not only
 * the pure core.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 *
 * COVERAGE: test-design-epic-2-foundation-consolidated.md Gap G-4 (INT slice); R-014.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
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
import { adminCountAuditEvents } from "../../factories/audit-events";
import type { CommandClock } from "@/server/commands/clock";

type ResolverClient = Parameters<typeof resolveTenantContext>[0] extends infer O
  ? O extends { client?: infer C }
    ? C
    : never
  : never;

const fixedClock: CommandClock = {
  now: () => new Date("2026-06-29T12:00:00.000Z"),
};

let stackUp = false;
let fixture: TwoTenantFixture;
let realAuthed: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  // A REAL authenticated session for Tenant A's admin — the auth leg stays live.
  realAuthed = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/**
 * A PostgREST-shaped transient error as the SDK surfaces it on a real outage
 * (connection reset / statement timeout). `57P01`/`53300` are real Postgres
 * SQLSTATEs for admin-shutdown / too-many-connections — i.e. a genuinely transient
 * infra fault, never an authorization decision.
 */
const TRANSIENT_DB_ERROR = {
  code: "57P01",
  message: "terminating connection due to administrator command",
} as const;

/**
 * Wrap a REAL authed client so `auth.getClaims()` stays live (real JWT validation)
 * but a read of `tenant_memberships` returns the transient `{ data: null, error }`
 * the resolver's membership-read branch maps to SERVER_ERROR. Every other table
 * (e.g. the envelope's ownership SELECT) passes straight through to the real client,
 * so this injects exactly ONE fault on exactly the membership-read seam.
 */
function withFailingMembershipRead(real: TestServerClient): ResolverClient {
  const failingMembershipQuery = {
    select: () => failingMembershipQuery,
    eq: () => failingMembershipQuery,
    order: () => failingMembershipQuery,
    limit: async () => ({ data: null, error: TRANSIENT_DB_ERROR }),
    then: undefined,
  };
  return new Proxy(real as unknown as object, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) =>
          table === "tenant_memberships"
            ? failingMembershipQuery
            : (target as TestServerClient).from(table);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as ResolverClient;
}

/** A minimal auditable command, so we can assert NO audit row is written on the fault. */
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

describe("SERVER_ERROR vs no-access at the integration level (Gap G-4 / R-014)", () => {
  it("[P2] resolveTenantContext maps a transient membership-read I/O error to SERVER_ERROR (NOT TENANT_MEMBERSHIP_REQUIRED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = withFailingMembershipRead(realAuthed);
    const result = await resolveTenantContext({ client });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The taxonomy fork: an outage is retryable SERVER_ERROR, never a permanent
      // "no membership" denial that would mislead the user/UI.
      expect(result.code).toBe("SERVER_ERROR");
      expect(result.code).not.toBe("TENANT_MEMBERSHIP_REQUIRED");
      // User-safe message: no raw SQLSTATE / internal detail crosses the boundary.
      expect(result.message.includes("57P01")).toBe(false);
    }
  });

  it("[P2] the command envelope surfaces SERVER_ERROR (not a no-access code) on a transient membership-read fault and writes NO audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const client = withFailingMembershipRead(realAuthed);
    const before = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });

    const result = await runCommand(makeNoopCommand(), {
      client: client as never,
      input: { note: "transient" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER_ERROR");
      expect(result.code).not.toBe("TENANT_MEMBERSHIP_REQUIRED");
      expect(result.code).not.toBe("TENANT_ACCESS_DENIED");
    }
    // Fail-closed: no execute, no audit row on the transient fault.
    const after = await adminCountAuditEvents({ tenantId: fixture.tenantA.id });
    expect(after).toBe(before);
  });
});
