/**
 * Story 8.1 — ATDD RED-PHASE scaffold: createFileLink BOTH-SIDE ownership +
 * atomic RPC rollback (AC3/AC7, P0 — 8.1-INT-02/04, R-802/R-807).
 *
 * The link-creation command proves the R-802 both-side check + the ADR-A009 atomic
 * metadata+link RPC rollback, through the EXISTING `defineCommand`/`runCommand`
 * envelope:
 *   - FOREIGN FILE id rejected: a Tenant-B file_id is invisible under A's RLS → the
 *     envelope ownership gate denies with TENANT_ACCESS_DENIED BEFORE execute;
 *   - FOREIGN OWNER id rejected: an own-tenant file but a Tenant-B owner record (a
 *     customer/facility/contact) → the command's owner-side own-tenant RLS SELECT
 *     finds zero rows → TENANT_ACCESS_DENIED (the second, execute-layer check);
 *   - own file + own owner SUCCEEDS → creates the link (via the atomic RPC) + EXACTLY
 *     ONE `file.linked` audit row with allow-listed metadata only (no owner PII, no
 *     path);
 *   - a DEFERRED owner_type (`quote_version`) is rejected as "not-yet-available" until
 *     Epics 6/7 add the owner table (the validator accepts it structurally; the
 *     owner-resolution switch returns the not-available rejection);
 *   - ATOMICITY (R-807): a mid-flow RPC failure leaves NEITHER a `files` orphan NOR a
 *     `file_links` row — an independent BYPASSRLS re-read proves zero rows.
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * `@/server/commands/files` (createFileLink), the `create_file_with_link` RPC, the
 * `files`/`file_links` migration, and the file factory seeds/read-backs do NOT exist
 * yet (Story 8.1 dev Tasks 2/5/6/7). The `notYetImplemented()` placeholders THROW so a
 * mistakenly un-skipped run fails LOUD; the file type-checks standalone today. The dev
 * phase swaps the placeholders for real imports and removes `.skip`.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-04T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/**
 * The not-yet-built surfaces this suite drives. RED PHASE: these THROW at call time.
 * GREEN-PHASE HAND-OFF (dev):
 *   import { createFileLink } from "@/server/commands/files";
 *   import { adminInsertFile, adminCountFileLinks } from "../../factories/tenants";
 * and drop these placeholders + the `.skip`.
 */
type FileSeed = { tenant_id: string; display_name: string };
function notYetImplemented(): {
  createFileLink: unknown;
  adminInsertFile: (seed: FileSeed) => Promise<string>;
} {
  throw new Error(
    "Story 8.1 RED PHASE: createFileLink + adminInsertFile are not implemented yet. " +
      "Remove `.skip` and import the real surfaces in the dev phase (Tasks 2/5/6/7).",
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;
let ownFileId: string; // A's own file
let ownCustomerId: string; // A's own owner record (customer)
let tenantBFileId: string; // REAL Tenant B file (foreign file target)
let tenantBCustomerId: string; // REAL Tenant B customer (foreign owner target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  const { adminInsertFile } = notYetImplemented();
  ownFileId = await adminInsertFile({
    tenant_id: fixture.tenantA.id,
    display_name: "own-file.pdf",
  });
  ownCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: "tenant-a-owner",
    org_nr: "556000-4444",
  });
  tenantBFileId = await adminInsertFile({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-file.pdf",
  });
  tenantBCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-owner",
    org_nr: "556000-5555",
  });
  if (!ownFileId || !ownCustomerId || !tenantBFileId || !tenantBCustomerId) {
    throw new Error(
      "file-link ownership seed produced no id — the both-side negatives would deny " +
        "VACUOUSLY.",
    );
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("createFileLink both-side ownership + atomic rollback (AC3/AC7)", () => {
  it("[P0/R-802] a FOREIGN file id is rejected (TENANT_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createFileLink } = notYetImplemented();
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: tenantBFileId, // B's file — invisible under A's RLS
        owner_type: "customer",
        owner_id: ownCustomerId,
        purpose: "crm_document",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0/R-802] a FOREIGN owner id is rejected (TENANT_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createFileLink } = notYetImplemented();
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: ownFileId, // A's own file (passes the file gate)
        owner_type: "customer",
        owner_id: tenantBCustomerId, // B's customer — the owner-side check denies
        purpose: "crm_document",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0] own file + own owner SUCCEEDS + EXACTLY ONE file.linked audit row (clean metadata)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createFileLink } = notYetImplemented();
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: ownFileId,
        owner_type: "customer",
        owner_id: ownCustomerId,
        purpose: "crm_document",
      },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    const events = await adminSelectAuditEvents({ correlationId });
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("file.linked");
    const meta = JSON.stringify(events[0]?.metadata ?? {});
    // No owner PII, no path — allow-listed target-shaped fields only.
    expect(meta).not.toMatch(/org_nr|556000|tenant-files|object_path|tenant-a-owner/i);
  });

  it("[P0] a DEFERRED owner_type (quote_version) is rejected as not-yet-available", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createFileLink } = notYetImplemented();
    // The validator accepts quote_version structurally, but the owner-resolution
    // switch returns a rejection because the owner table does not exist until Epics 6/7.
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: ownFileId,
        owner_type: "quote_version",
        owner_id: crypto.randomUUID(),
        purpose: "quote_attachment_snapshot",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    // A generic, user-safe rejection — the not-yet-available owner type maps to a
    // stable denial code (TENANT_ACCESS_DENIED or VALIDATION_FAILED; assert the set).
    if (!result.ok) {
      expect(["TENANT_ACCESS_DENIED", "VALIDATION_FAILED"]).toContain(result.code);
    }
  });

  it("[P0/AC7/R-807] a mid-flow RPC failure rolls back FULLY — no files orphan, no file_links row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createFileLink } = notYetImplemented();
    // Drive the atomic RPC path with an input that produces a mid-flow constraint
    // error AFTER the files insert but before/within the link insert (e.g. a link
    // that violates a check/FK). The whole transaction must roll back.
    //
    // NOTE for the dev phase: pick the concrete failure injection that matches the
    // final create_file_with_link signature (the RPC also writes a `files` row for
    // the real upload path in 8.2; here it is exercised so a constraint violation in
    // the link half rolls back the file half too). The ASSERTION contract is fixed:
    // an independent BYPASSRLS re-read finds ZERO new files AND ZERO new file_links.
    const marker = `rollback-marker-${crypto.randomUUID()}`;
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: ownFileId,
        owner_type: "customer",
        owner_id: crypto.randomUUID(), // non-existent owner → owner-side denial / RPC FK error
        purpose: "crm_document",
        __rollback_probe_display_name: marker, // dev phase wires this to the RPC's file insert
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);

    // Independent BYPASSRLS re-read: no `files` row carrying the marker was left behind.
    const orphanFiles = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files where display_name = $1`,
      [marker],
    );
    expect(Number(orphanFiles[0]?.n)).toBe(0);

    // ...and no `file_links` row for that owner id was left behind either.
    const orphanLinks = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links
         where file_id = $1 and owner_type = 'customer'
           and created_at >= (now() - interval '1 minute')`,
      [ownFileId],
    );
    expect(Number(orphanLinks[0]?.n)).toBe(0);
  });
});
