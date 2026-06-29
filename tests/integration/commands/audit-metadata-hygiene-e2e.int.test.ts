/**
 * GAP G-7 (P2) — END-TO-END audit metadata hygiene through a command that ACTUALLY
 * routes caller-controlled metadata to the audit row.
 *
 * The consolidated foundation test design (`test-design-epic-2-foundation-
 * consolidated.md`, Gap G-7) flags that the INT happy-path proof of R-010 is
 * near-VACUOUS: the existing happy-path command (`envelope-audit-write.int.test.ts`'s
 * `makeNoopCommand`) declares NO `auditFields`, so caller input never reached a
 * metadata path AT ALL — a smuggled secret was dropped because nothing forwarded it,
 * not because the sanitizer caught it. The strong proof today is the pure-unit
 * sanitizer suite (`audit-metadata*.test.ts`).
 *
 * This file closes the gap with a command whose `auditFields` DELIBERATELY forwards
 * caller-controlled metadata (`config.auditFields(ctx, result) → { metadata }`),
 * driving it through `sanitizeAuditMetadata` inside `writeAuditEvent`, then asserts —
 * against the PERSISTED row (BYPASSRLS re-read) — that:
 *   1. forbidden content (an unknown `apiKey`/`serviceRoleKey`, an `env` blob, a long
 *      free-text PII `note`, a value carrying control chars) is DROPPED end-to-end, and
 *   2. an ALLOW-LISTED field (`reason`) the caller supplies SURVIVES — proving the
 *      metadata is genuinely on the persisted path (so dropping forbidden keys is the
 *      sanitizer biting, not metadata being inert).
 *
 * Assertion 2 is what makes this non-vacuous: if NOTHING flowed, `reason` would be
 * absent and the test would (incorrectly) still see "no secret". Requiring `reason` to
 * persist forces a real metadata path.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 *
 * COVERAGE: test-design-epic-2-foundation-consolidated.md Gap G-7; AC5; R-010.
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
import type { CommandClock } from "@/server/commands/clock";

const fixedClock: CommandClock = {
  now: () => new Date("2026-06-29T12:00:00.000Z"),
};

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
 * A command whose `auditFields` ROUTES caller-controlled metadata to the audit write.
 * `validateInput` deliberately carries the raw caller object forward (a realistic
 * "command echoes some of its input into the audit metadata" shape), and `auditFields`
 * forwards it as `metadata` — so the ONLY thing standing between caller input and the
 * persisted row is `sanitizeAuditMetadata`. This is the exact path the no-op command
 * lacked.
 */
function makeMetadataRoutingCommand() {
  type Input = { reason: string; payload: Record<string, unknown> };
  return defineCommand<Input, { targetId: string; payload: Record<string, unknown> }>({
    command: "tenant.metadata.route",
    auditable: true,
    eventType: "tenant.metadata.routed",
    targetType: "tenant",
    validateInput: (raw) => {
      const obj = (raw as Partial<Input> | null) ?? {};
      return typeof obj.reason === "string"
        ? {
            ok: true,
            data: {
              reason: obj.reason,
              payload:
                obj.payload && typeof obj.payload === "object"
                  ? (obj.payload as Record<string, unknown>)
                  : {},
            },
          }
        : { ok: false, code: "VALIDATION_FAILED" };
    },
    execute: async (ctx) => ({
      targetId: ctx.tenantContext.tenantId,
      payload: ctx.input.payload,
    }),
    // Forward caller-controlled fields straight into the audit metadata — the
    // sanitizer is the only gate. (`reason` is allow-listed and should survive; the
    // rest is forbidden and must be dropped.)
    auditFields: (ctx) => ({
      targetId: ctx.tenantContext.tenantId,
      metadata: { reason: ctx.input.reason, ...ctx.input.payload },
    }),
  });
}

describe("End-to-end audit metadata hygiene through a metadata-routing command (Gap G-7 / R-010)", () => {
  it("[P2] forbidden caller metadata is DROPPED in the persisted row while the allow-listed field survives (proves the sanitizer is on the path)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const command = makeMetadataRoutingCommand();
    const correlationId = crypto.randomUUID();

    await runCommand(command, {
      client: a as never,
      input: {
        reason: "membership_disabled", // allow-listed → must SURVIVE
        payload: {
          // All forbidden → must be DROPPED end-to-end:
          apiKey: "sk_live_must_not_persist",
          serviceRoleKey: "eyJhbGservice_role_must_not_persist",
          env: "SUPABASE_SERVICE_ROLE_KEY=super-secret",
          note: "x".repeat(500), // over-length free-text PII blob (not allow-listed)
          fileContents: "line1\nline2\nDATABASE_URL=postgres://secret", // control chars + secret
        },
      } as never,
      clock: fixedClock,
      correlationId,
    });

    const rows = await adminSelectAuditEvents({ correlationId });
    expect(rows.length).toBe(1);
    const metadata = rows[0].metadata as Record<string, unknown>;
    const serialized = JSON.stringify(metadata);

    // 1) Forbidden content is dropped END-TO-END (not just at the unit level).
    expect(serialized.includes("sk_live_must_not_persist")).toBe(false);
    expect(serialized.includes("service_role_must_not_persist")).toBe(false);
    expect(serialized.includes("SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
    expect(serialized.includes("DATABASE_URL")).toBe(false);
    expect("apiKey" in metadata).toBe(false);
    expect("serviceRoleKey" in metadata).toBe(false);
    expect("env" in metadata).toBe(false);
    expect("note" in metadata).toBe(false);
    expect("fileContents" in metadata).toBe(false);

    // 2) The allow-listed field SURVIVES — proving metadata genuinely flowed and the
    //    sanitizer (not an inert path) is what dropped the forbidden keys.
    expect(metadata.reason).toBe("membership_disabled");
  });
});
