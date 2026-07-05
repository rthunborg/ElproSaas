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
 * ── GREEN as of Story 8.1 dev ───────────────────────────────────────────────────
 * `@/server/commands/files` (createFileLink), the `create_file_with_link` RPC, the
 * `files`/`file_links` migration, and the file factory seeds/read-backs have landed
 * (Tasks 2/5/6/7). The real surfaces are imported and `.skip` is removed.
 *
 * ── ATOMICITY (R-807) ───────────────────────────────────────────────────────────
 * The command's both-side ownership check rejects a foreign/non-existent owner BEFORE
 * the RPC runs, so the "no orphan on a denied command" assertion holds trivially. To
 * PROVE the RPC's file→link rollback ordering (the file insert rolls back when the
 * link insert fails mid-flow), a dedicated test drives the RPC DIRECTLY under the
 * caller's authed client with a VALID file half but an INVALID link half (an
 * out-of-union owner_type that passes no command validator — bypassed here on purpose):
 * the files row must NOT survive because the link insert raises and rolls the txn back.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertCalculation,
  adminInsertFile,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createFileLink } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-04T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** A supabase client's `.rpc` surface, narrowed for the direct-RPC negatives. */
type RpcCapableClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

/** Args for the atomic RPC with a valid file-half + a valid active link-half. */
function validRpcArgs(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    p_tenant_id: null,
    p_bucket_id: "tenant-files",
    p_object_path: null,
    p_display_name: null,
    p_mime_type: null,
    p_size_bytes: null,
    p_checksum: null,
    p_uploaded_by: null,
    p_lifecycle_state: "linked",
    p_owner_type: "customer",
    p_owner_id: null,
    p_purpose: "crm_document",
    ...overrides,
  };
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;
let anon: TestServerClient; // unauthenticated client (no session)
let ownFileId: string; // A's own file
let ownCustomerId: string; // A's own owner record (customer)
let tenantBFileId: string; // REAL Tenant B file (foreign file target)
let tenantBCustomerId: string; // REAL Tenant B customer (foreign owner target)

// A's own owner records across ALL FOUR ACTIVE owner types (customer/facility/contact/
// calculation) so the R-802 owner-side check is exercised for EVERY ownerTableFor branch,
// not customer alone. Each has a matching Tenant-B foreign owner for the negative.
let ownFacilityId: string;
let ownContactId: string;
let ownCalculationId: string;
let tenantBFacilityId: string;
let tenantBContactId: string;
let tenantBCalculationId: string;

/** The active owner types + how to resolve the seeded own / foreign owner id per type. */
interface OwnerTypeCase {
  readonly ownerType: "customer" | "facility" | "contact" | "calculation";
  readonly ownId: () => string;
  readonly foreignId: () => string;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
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

  // Seed the OTHER three active owner types for BOTH tenants (facility/contact require a
  // parent customer in the SAME tenant; calculation requires a same-tenant customer).
  ownFacilityId = await adminInsertFacility({
    tenant_id: fixture.tenantA.id,
    customer_id: ownCustomerId,
    name: "tenant-a-facility",
  });
  ownContactId = await adminInsertContact({
    tenant_id: fixture.tenantA.id,
    customer_id: ownCustomerId,
    name: "tenant-a-contact",
  });
  ownCalculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: ownCustomerId,
  });
  tenantBFacilityId = await adminInsertFacility({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    name: "tenant-b-facility",
  });
  tenantBContactId = await adminInsertContact({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    name: "tenant-b-contact",
  });
  tenantBCalculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
  });

  if (
    !ownFileId ||
    !ownCustomerId ||
    !tenantBFileId ||
    !tenantBCustomerId ||
    !ownFacilityId ||
    !ownContactId ||
    !ownCalculationId ||
    !tenantBFacilityId ||
    !tenantBContactId ||
    !tenantBCalculationId
  ) {
    throw new Error(
      "file-link ownership seed produced no id — the both-side negatives would deny " +
        "VACUOUSLY.",
    );
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("createFileLink both-side ownership + atomic rollback (AC3/AC7)", () => {
  it("[P0/R-802] a FOREIGN file id is rejected (TENANT_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
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
    // POSITIVE allow-list (mirrors the createSignedFileAccess success test): the
    // sanitized audit metadata is EXACTLY empty (targetId lives in the target_id column,
    // not metadata) — a stray leaked field (uploaded_by/owner_id/object_path) fails HERE
    // even if it would slip past the belt-and-braces blocklist below.
    expect(Object.keys(events[0]?.metadata ?? {})).toEqual([]);
    const meta = JSON.stringify(events[0]?.metadata ?? {});
    // Belt-and-braces: no owner PII, no path — allow-listed target-shaped fields only.
    expect(meta).not.toMatch(/org_nr|556000|tenant-files|object_path|tenant-a-owner/i);
  });

  // Parametrize the R-802 owner-side check across ALL FOUR active owner types so every
  // `ownerTableFor` branch (customers/facilities/contacts/calculations) is exercised — a
  // wrong table name or an unexpected owner-table RLS behavior for facility/contact/
  // calculation would otherwise escape the P0 suite (only `customer` was covered).
  const ownerTypeCases: OwnerTypeCase[] = [
    { ownerType: "customer", ownId: () => ownCustomerId, foreignId: () => tenantBCustomerId },
    { ownerType: "facility", ownId: () => ownFacilityId, foreignId: () => tenantBFacilityId },
    { ownerType: "contact", ownId: () => ownContactId, foreignId: () => tenantBContactId },
    {
      ownerType: "calculation",
      ownId: () => ownCalculationId,
      foreignId: () => tenantBCalculationId,
    },
  ];

  describe.each(ownerTypeCases)(
    "R-802 owner-side check per active owner type: $ownerType",
    ({ ownerType, ownId, foreignId }) => {
      it(`[P0/R-802] own file + own ${ownerType} owner SUCCEEDS (owner-side SELECT resolves)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const result = await runCommand(createFileLink as never, {
          client: a as never,
          input: {
            file_id: ownFileId,
            owner_type: ownerType,
            owner_id: ownId(),
            purpose: "crm_document",
          },
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        });
        expect(result.ok).toBe(true);
      });

      it(`[P0/R-802] a FOREIGN ${ownerType} owner id is rejected (TENANT_ACCESS_DENIED)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const result = await runCommand(createFileLink as never, {
          client: a as never,
          input: {
            file_id: ownFileId,
            owner_type: ownerType,
            owner_id: foreignId(), // Tenant B's owner — the owner-side check denies
            purpose: "crm_document",
          },
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
      });
    },
  );

  it("[P0] a DEFERRED owner_type (quote_version) is rejected as not-yet-available", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
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
    // The not-yet-available owner type is a DETERMINISTIC rejection: production
    // (`assertOwnerVisibleOrThrow`) throws TENANT_ACCESS_DENIED and AC3 mandates that
    // exact code. Pin it (not an alternatives set) so a future silent drift to the wrong
    // code fails CI on this security-relevant rejection.
    if (!result.ok) {
      expect(result.code).toBe("TENANT_ACCESS_DENIED");
    }
  });

  it("[P0/R-802] a non-existent owner id denies with NO orphan created (command owner-side gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A non-existent owner id fails the command's owner-side own-tenant SELECT BEFORE
    // the RPC runs → TENANT_ACCESS_DENIED. Nothing is written: no new files row (the RPC
    // never fired) and no file_links row.
    const randomOwner = crypto.randomUUID();
    const result = await runCommand(createFileLink as never, {
      client: a as never,
      input: {
        file_id: ownFileId,
        owner_type: "customer",
        owner_id: randomOwner, // non-existent owner → owner-side denial (before RPC)
        purpose: "crm_document",
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
    // No file_links row for that owner id was written.
    const links = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links where owner_id = $1`,
      [randomOwner],
    );
    expect(Number(links[0]?.n)).toBe(0);
  });

  it("[P0/AC7/R-807] the atomic RPC rolls back FULLY when the link half fails mid-flow — no files orphan", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Drive the atomic `create_file_with_link` RPC DIRECTLY under the caller's authed
    // client (bypassing the command validator on purpose) with a VALID file half but an
    // INVALID link half: an out-of-union owner_type violates the file_links.owner_type
    // CHECK (23514), which raises AFTER the files insert but WITHIN the same txn. The
    // whole function must roll back — the files row must NOT survive. This is the R-807
    // ordering proof the command-level gate cannot exercise (the command rejects a bad
    // owner_type before the RPC).
    const markerPath = `${fixture.tenantA.id}/${crypto.randomUUID()}/rollback-probe.pdf`;
    const marker = `rollback-marker-${crypto.randomUUID()}`;
    const { error } = await (a as never as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { code?: string } | null }>;
    }).rpc("create_file_with_link", {
      p_tenant_id: fixture.tenantA.id,
      p_bucket_id: "tenant-files",
      p_object_path: markerPath,
      p_display_name: marker,
      p_mime_type: null,
      p_size_bytes: null,
      p_checksum: null,
      p_uploaded_by: null,
      p_lifecycle_state: "linked",
      p_owner_type: "not_a_real_owner_type", // violates the file_links owner_type CHECK
      p_owner_id: ownCustomerId,
      p_purpose: "crm_document",
    });
    // The RPC raised (the link-half CHECK violation) — the whole txn rolled back.
    expect(error).not.toBeNull();

    // Independent BYPASSRLS re-read: NO `files` row carrying the marker survived (the
    // file insert was rolled back with the failed link insert — R-807 atomicity).
    const orphanFiles = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files where display_name = $1`,
      [marker],
    );
    expect(Number(orphanFiles[0]?.n)).toBe(0);
    // ...and no object_path orphan either.
    const orphanByPath = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files where object_path = $1`,
      [markerPath],
    );
    expect(Number(orphanByPath[0]?.n)).toBe(0);
  });

  it("[P0/R-801/R-803] an ANONYMOUS caller has NO EXECUTE on create_file_with_link (42501, not vacuous)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The atomic write RPC does `revoke execute … from public; grant … to
    // authenticated, service_role` (migration Task 6.2) — an unauthenticated caller must
    // be denied at the PRIVILEGE layer, mirroring the record_audit_event anon-EXECUTE
    // guard. A future accidental `grant … to anon` would hand an anonymous caller the
    // whole atomic files+file_links write path; this pins that the grant stays closed.
    // Assert the 42501 SQLSTATE explicitly (not a bare `data == null`/`!error`
    // disjunction — the Story 2.2 G2 lesson: a vacuous check would still pass after an
    // anon grant regression).
    const markerPath = `${fixture.tenantA.id}/${crypto.randomUUID()}/anon-rpc-probe.pdf`;
    const marker = `anon-rpc-marker-${crypto.randomUUID()}`;
    const { data, error } = await (anon as never as RpcCapableClient).rpc(
      "create_file_with_link",
      validRpcArgs({
        p_tenant_id: fixture.tenantA.id,
        p_object_path: markerPath,
        p_display_name: marker,
        p_owner_id: ownCustomerId,
      }),
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).not.toBe(true);
    // Defense-in-depth: even if the privilege check ever regressed, nothing persisted.
    const wrote = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files where display_name = $1`,
      [marker],
    );
    expect(Number(wrote[0]?.n)).toBe(0);
  });

  it("[P0/R-802/R-807] an authed Tenant A caller CANNOT forge a Tenant B p_tenant_id through the RPC — denied + no B-side write", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The RPC is SECURITY INVOKER, so it runs under the CALLER's RLS: the files INSERT
    // WITH CHECK (`is_tenant_admin(tenant_id)`) rejects a row carrying ANOTHER tenant's
    // id with 42501, and the whole txn rolls back (R-802 write-path defense + R-807
    // atomicity). Tenant A drives the RPC directly with `p_tenant_id = tenantB.id` — the
    // migration comment claims this fails; assert the DENIAL MECHANISM, not just absence.
    const markerPath = `${fixture.tenantB.id}/${crypto.randomUUID()}/forged-tenant-probe.pdf`;
    const marker = `forged-tenant-marker-${crypto.randomUUID()}`;
    const { error } = await (a as never as RpcCapableClient).rpc(
      "create_file_with_link",
      validRpcArgs({
        p_tenant_id: fixture.tenantB.id, // forged — A is NOT admin of tenant B
        p_object_path: markerPath,
        p_display_name: marker,
        // owner_id belongs to B too, but the files INSERT fails first (WITH CHECK) — the
        // owner-record ownership is a COMMAND-layer check the RPC never reaches here.
        p_owner_id: tenantBCustomerId,
      }),
    );
    // The forged files INSERT WITH CHECK raised under A's RLS → the RPC errored.
    expect(error).not.toBeNull();
    // Independent BYPASSRLS re-read: NEITHER a Tenant-B `files` row NOR a `file_links`
    // row for the forged path/marker survived — the txn rolled back fully.
    const forgedFiles = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files where display_name = $1 or object_path = $2`,
      [marker, markerPath],
    );
    expect(Number(forgedFiles[0]?.n)).toBe(0);
    const forgedLinks = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links
         where tenant_id = $1 and owner_id = $2 and created_at > now() - interval '1 minute'`,
      [fixture.tenantB.id, tenantBCustomerId],
    );
    expect(Number(forgedLinks[0]?.n)).toBe(0);
  });

  // ── link_existing_file direct-RPC privilege negatives ────────────────────────────
  // `createFileLink` production now calls `link_existing_file` (the iteration-1 High
  // rewired it away from `create_file_with_link`), so the privilege boundary of the LIVE
  // RPC must have its OWN direct-RPC negatives — the `create_file_with_link` probes above
  // now cover only the RPC 8.2's upload path still uses, not the shipped link path.
  it("[P0/R-801/R-803] an ANONYMOUS caller has NO EXECUTE on link_existing_file (42501, not vacuous)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The shipped link RPC does `revoke execute … from public; grant … to authenticated,
    // service_role` (migration Task 6.2) — an unauthenticated caller must be denied at the
    // PRIVILEGE layer. Assert the 42501 SQLSTATE explicitly (not a vacuous `!error`): a
    // future accidental `grant … to anon` would otherwise hand an anon caller the live
    // link-write path.
    // Baseline the current link count for this file/owner (earlier happy-path tests in
    // this suite legitimately link ownFileId→ownCustomerId), so the defense-in-depth
    // re-read asserts the anon RPC added NOTHING rather than an absolute zero.
    const before = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links
         where tenant_id = $1 and file_id = $2 and owner_id = $3`,
      [fixture.tenantA.id, ownFileId, ownCustomerId],
    );
    const { data, error } = await (anon as never as RpcCapableClient).rpc(
      "link_existing_file",
      {
        p_tenant_id: fixture.tenantA.id,
        p_file_id: ownFileId,
        p_owner_type: "customer",
        p_owner_id: ownCustomerId,
        p_purpose: "crm_document",
      },
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).not.toBe(true);
    // Defense-in-depth: even if the privilege check ever regressed, the anon call added
    // no new row (count unchanged from the pre-call baseline).
    const after = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links
         where tenant_id = $1 and file_id = $2 and owner_id = $3`,
      [fixture.tenantA.id, ownFileId, ownCustomerId],
    );
    expect(Number(after[0]?.n)).toBe(Number(before[0]?.n));
  });

  it("[P0/R-802/R-807] an authed Tenant A caller CANNOT forge a Tenant B p_tenant_id through link_existing_file — denied + no B-side link", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // The RPC is SECURITY INVOKER, so it runs under the CALLER's RLS: the file_links INSERT
    // WITH CHECK (own-tenant) rejects a row carrying ANOTHER tenant's id with 42501 (and the
    // composite same-tenant FK would also reject a cross-tenant file). Tenant A drives the
    // RPC directly with `p_tenant_id = tenantB.id` (+ a B-side file/owner) — assert the
    // DENIAL and that NO B-side `file_links` row survives (independent BYPASSRLS re-read).
    const { error } = await (a as never as RpcCapableClient).rpc(
      "link_existing_file",
      {
        p_tenant_id: fixture.tenantB.id, // forged — A is NOT admin of tenant B
        p_file_id: tenantBFileId,
        p_owner_type: "customer",
        p_owner_id: tenantBCustomerId,
        p_purpose: "crm_document",
      },
    );
    // The forged file_links INSERT WITH CHECK raised under A's RLS → the RPC errored.
    expect(error).not.toBeNull();
    // Independent BYPASSRLS re-read: NO Tenant-B `file_links` row for the forged
    // file/owner survived — the write was denied, nothing persisted.
    const forgedLinks = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links
         where tenant_id = $1 and file_id = $2 and owner_id = $3
           and created_at > now() - interval '1 minute'`,
      [fixture.tenantB.id, tenantBFileId, tenantBCustomerId],
    );
    expect(Number(forgedLinks[0]?.n)).toBe(0);
  });
});
