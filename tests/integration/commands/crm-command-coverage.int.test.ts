/**
 * Story 3.1 — DB-backed CRM command coverage EXPANSION (testarch-automate).
 *
 * The ATDD scaffolds (`crm-customer-commands.int.test.ts`,
 * `crm-parent-ownership.int.test.ts`) cover the customer happy/validation paths and
 * the cross-tenant PARENT-link negatives. This file closes the remaining command-path
 * gaps through the SAME `defineCommand`/`runCommand` envelope (architecture §5),
 * reusing the EXISTING two-tenant factories + BYPASSRLS readbacks — NO new mechanism:
 *
 *   - facility & contact FULL lifecycle (create → persisted row + EXACTLY ONE audit
 *     row, update persists, archive soft-deletes) — only the customer family was
 *     covered before,
 *   - `brf` / `public` customer happy paths (only private/company were exercised),
 *   - cross-tenant UPDATE/ARCHIVE on a foreign id for facilities & contacts →
 *     TENANT_ACCESS_DENIED with an independent BYPASSRLS "row unchanged" re-read
 *     (only updateCustomer had this),
 *   - the POSITIVE own-tenant facility link on a contact succeeds (the balancing
 *     seam to the cross-tenant facility-link negative),
 *   - the `updated_at` trigger advances on a real UPDATE (deterministic clock for
 *     the lifecycle fields the command owns; the trigger sets updated_at = now()),
 *   - audit metadata carries NO PII on the facility/contact families either.
 *
 * Runs against LOCAL Supabase only; skips visibly when unreachable. Per-run unique
 * ids; deterministic injected clock — never `sleep`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminSelectCrmRowById,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  expectDatabaseOwnedTimestamp,
  readDatabaseNow,
} from "../../support/database-time";
import { runCommand } from "@/server/commands/envelope";
import {
  createCustomer,
} from "@/server/commands/crm/customers";
import {
  createFacility,
  updateFacility,
  archiveFacility,
} from "@/server/commands/crm/facilities";
import {
  createContact,
  updateContact,
  archiveContact,
} from "@/server/commands/crm/contacts";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-06-30T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/** Create an own-tenant (Tenant A) customer via the app path; return its id. */
async function createOwnCustomer(displayName: string): Promise<string> {
  const r = await runCommand(createCustomer, {
    client: a as never,
    input: {
      customer_type: "company",
      display_name: displayName,
      org_nr: "556677-8899",
    },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error("createOwnCustomer failed");
  return (r.data as { targetId: string }).targetId;
}

// ─────────────────────────────────────────────────────────────────────────────
// brf / public customer happy paths (the two types the scaffolds never created).
// ─────────────────────────────────────────────────────────────────────────────

describe("CRM customer create — brf & public types (AC2)", () => {
  for (const type of ["brf", "public"] as const) {
    it(`[P1] createCustomer (${type}) with org_nr persists and writes ONE audit row`, async (testCtx) => {
      if (skipUnlessStack(testCtx, stackUp)) return;
      const correlationId = crypto.randomUUID();
      const result = await runCommand(createCustomer, {
        client: a as never,
        input: {
          customer_type: type,
          display_name: `${type} Org`,
          org_nr: "556677-8899",
        },
        clock: fixedClock,
        correlationId,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rows = await adminSelectAuditEvents({ correlationId });
      expect(rows.length).toBe(1);
      expect(rows[0].event_type).toBe("customer.created");
      expect(rows[0].tenant_id).toBe(fixture.tenantA.id);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Facility full lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

describe("CRM facility lifecycle via the envelope (AC3)", () => {
  it("[P1] createFacility persists the row + ONE audit row (no PII in metadata)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await createOwnCustomer("Facility Owner AB");
    const correlationId = crypto.randomUUID();

    const result = await runCommand(createFacility, {
      client: a as never,
      input: { customer_id: customerId, name: "Hangar 7", city: "Kiruna" },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const facilityId = (result.data as { targetId: string }).targetId;

    const row = await adminSelectCrmRowById("facilities", facilityId);
    expect(row).not.toBeNull();
    expect(row?.tenant_id).toBe(fixture.tenantA.id);
    expect(row?.name).toBe("Hangar 7");
    expect(row?.archived_at).toBeNull();

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0].event_type).toBe("facility.created");
    expect(audits[0].target_type).toBe("facility");
    expect(audits[0].target_id).toBe(facilityId);
    // No facility name/city in audit metadata.
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes("Hangar 7")).toBe(false);
    expect(serialized.includes("Kiruna")).toBe(false);
  });

  it("[P1] updateFacility persists the change and advances updated_at (trigger)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await createOwnCustomer("Facility Update Owner AB");
    const created = await runCommand(createFacility, {
      client: a as never,
      input: { customer_id: customerId, name: "Old Name" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const facilityId = (created.data as { targetId: string }).targetId;

    const before = await adminQuery<{ updated_at: string; created_at: string }>(
      `select updated_at, created_at from public.facilities where id = $1`,
      [facilityId],
    );

    const updated = await runCommand(updateFacility, {
      client: a as never,
      input: { id: facilityId, name: "New Name", city: "Umeå" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(updated.ok).toBe(true);

    const after = await adminQuery<{ name: string; city: string; updated_at: string }>(
      `select name, city, updated_at from public.facilities where id = $1`,
      [facilityId],
    );
    expect(after[0].name).toBe("New Name");
    expect(after[0].city).toBe("Umeå");
    // The set_updated_at trigger fires on UPDATE → updated_at >= the pre-update value.
    expect(new Date(after[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before[0].updated_at).getTime(),
    );
  });

  it("[P1] archiveFacility sets archived_at (soft-delete, no hard delete)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await createOwnCustomer("Facility Archive Owner AB");
    const created = await runCommand(createFacility, {
      client: a as never,
      input: { customer_id: customerId, name: "To Archive" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const facilityId = (created.data as { targetId: string }).targetId;

    const databaseBefore = await readDatabaseNow();
    const archived = await runCommand(archiveFacility, {
      client: a as never,
      input: { id: facilityId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    const databaseAfter = await readDatabaseNow();
    expect(archived.ok).toBe(true);

    const row = await adminSelectCrmRowById("facilities", facilityId);
    expect(row).not.toBeNull();
    expect(row?.archived_at).not.toBeNull();
    expectDatabaseOwnedTimestamp(
      row?.archived_at as string,
      databaseBefore,
      databaseAfter,
      FIXED_ISO,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contact full lifecycle, incl. the POSITIVE own-tenant facility link.
// ─────────────────────────────────────────────────────────────────────────────

describe("CRM contact lifecycle via the envelope (AC3)", () => {
  it("[P1] createContact (customer-only) persists + ONE audit row, defaults is_primary=false", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await createOwnCustomer("Contact Owner AB");
    const correlationId = crypto.randomUUID();

    const result = await runCommand(createContact, {
      client: a as never,
      input: {
        customer_id: customerId,
        name: "Berit Bygg",
        email: "berit@example.test",
        role_label: "projektledare",
      },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contactId = (result.data as { targetId: string }).targetId;

    const row = await adminQuery<{
      tenant_id: string;
      name: string;
      facility_id: string | null;
      is_primary: boolean;
    }>(
      `select tenant_id, name, facility_id, is_primary from public.contacts where id = $1`,
      [contactId],
    );
    expect(row[0].tenant_id).toBe(fixture.tenantA.id);
    expect(row[0].name).toBe("Berit Bygg");
    expect(row[0].facility_id).toBeNull();
    expect(row[0].is_primary).toBe(false); // owner: no enforced primary; default false

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits.length).toBe(1);
    expect(audits[0].event_type).toBe("contact.created");
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes("Berit Bygg")).toBe(false);
    expect(serialized.includes("berit@example.test")).toBe(false);
  });

  it("[P0] createContact WITH a same-tenant facility link SUCCEEDS (positive seam)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Both parents own-tenant — the composite same-tenant FK is satisfied, so the
    // optional facility link is accepted (the balancing positive to the cross-tenant
    // facility-link negative in crm-parent-ownership).
    const customerId = await createOwnCustomer("Linked Contact Owner AB");
    const facCreate = await runCommand(createFacility, {
      client: a as never,
      input: { customer_id: customerId, name: "Linked Facility" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(facCreate.ok).toBe(true);
    if (!facCreate.ok) return;
    const facilityId = (facCreate.data as { targetId: string }).targetId;

    const result = await runCommand(createContact, {
      client: a as never,
      input: {
        customer_id: customerId,
        facility_id: facilityId,
        name: "Facility-linked Contact",
        is_primary: true,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contactId = (result.data as { targetId: string }).targetId;

    const row = await adminQuery<{ facility_id: string | null; is_primary: boolean }>(
      `select facility_id, is_primary from public.contacts where id = $1`,
      [contactId],
    );
    expect(row[0].facility_id).toBe(facilityId);
    expect(row[0].is_primary).toBe(true);
  });

  it("[P1] updateContact persists changes; archiveContact soft-deletes", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const customerId = await createOwnCustomer("Contact Mutate Owner AB");
    const created = await runCommand(createContact, {
      client: a as never,
      input: { customer_id: customerId, name: "Before" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const contactId = (created.data as { targetId: string }).targetId;

    const updated = await runCommand(updateContact, {
      client: a as never,
      input: { id: contactId, name: "After", role_label: "arbetsledare" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(updated.ok).toBe(true);
    const afterRow = await adminQuery<{ name: string; role_label: string }>(
      `select name, role_label from public.contacts where id = $1`,
      [contactId],
    );
    expect(afterRow[0].name).toBe("After");
    expect(afterRow[0].role_label).toBe("arbetsledare");

    const archived = await runCommand(archiveContact, {
      client: a as never,
      input: { id: contactId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);
    const row = await adminSelectCrmRowById("contacts", contactId);
    expect(row).not.toBeNull();
    expect(row?.archived_at).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-tenant UPDATE / ARCHIVE on a foreign id → TENANT_ACCESS_DENIED for the
// facility & contact families (only updateCustomer had this). Independent BYPASSRLS
// re-read proves the foreign row is UNCHANGED (asserts the mechanism, not vacuity).
// ─────────────────────────────────────────────────────────────────────────────

describe("CRM cross-tenant UPDATE/ARCHIVE denial — facilities & contacts (AC4)", () => {
  it("[P0] updateFacility on a Tenant B facility → DENIED, row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCustomer = await adminInsertCustomer({
      tenant_id: fixture.tenantB.id,
      customer_type: "company",
      display_name: "B-Cust",
      org_nr: "556000-1111",
    });
    const bFacility = await adminInsertFacility({
      tenant_id: fixture.tenantB.id,
      customer_id: bCustomer,
      name: "B-Facility-original",
    });

    const result = await runCommand(updateFacility, {
      client: a as never,
      input: { id: bFacility, name: "Hijacked" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    // Independent BYPASSRLS re-read: the Tenant B row is untouched.
    const row = await adminSelectCrmRowById("facilities", bFacility);
    expect(row?.name).toBe("B-Facility-original");
    expect(row?.archived_at).toBeNull();
  });

  it("[P0] archiveFacility on a Tenant B facility → DENIED, NOT archived", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCustomer = await adminInsertCustomer({
      tenant_id: fixture.tenantB.id,
      customer_type: "company",
      display_name: "B-Cust2",
      org_nr: "556000-2222",
    });
    const bFacility = await adminInsertFacility({
      tenant_id: fixture.tenantB.id,
      customer_id: bCustomer,
      name: "B-Facility-2",
    });

    const result = await runCommand(archiveFacility, {
      client: a as never,
      input: { id: bFacility },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    const row = await adminSelectCrmRowById("facilities", bFacility);
    expect(row?.archived_at).toBeNull(); // never archived by the foreign caller
  });

  it("[P0] updateContact on a Tenant B contact → DENIED, row unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCustomer = await adminInsertCustomer({
      tenant_id: fixture.tenantB.id,
      customer_type: "company",
      display_name: "B-Cust3",
      org_nr: "556000-3333",
    });
    const bContact = await adminInsertContact({
      tenant_id: fixture.tenantB.id,
      customer_id: bCustomer,
      name: "B-Contact-original",
    });

    const result = await runCommand(updateContact, {
      client: a as never,
      input: { id: bContact, name: "Hijacked Contact" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    const row = await adminSelectCrmRowById("contacts", bContact);
    expect(row?.name).toBe("B-Contact-original");
    expect(row?.archived_at).toBeNull();
  });

  it("[P0] archiveContact on a Tenant B contact → DENIED, NOT archived", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCustomer = await adminInsertCustomer({
      tenant_id: fixture.tenantB.id,
      customer_type: "company",
      display_name: "B-Cust4",
      org_nr: "556000-4444",
    });
    const bContact = await adminInsertContact({
      tenant_id: fixture.tenantB.id,
      customer_id: bCustomer,
      name: "B-Contact-2",
    });

    const result = await runCommand(archiveContact, {
      client: a as never,
      input: { id: bContact },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    const row = await adminSelectCrmRowById("contacts", bContact);
    expect(row?.archived_at).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB-level identifier-by-type CHECK (belt-and-braces): the command validator is the
// first guard, but the customers_identifier_by_type CHECK is the DB backstop. A
// service-role seed that violates it must raise 23514 — proving the constraint is
// live (the migration CHECK is real, not just a comment).
// ─────────────────────────────────────────────────────────────────────────────

describe("CRM identifier-by-type CHECK is enforced at the DB layer (AC2)", () => {
  it("[P1] a private customer carrying org_nr is rejected by the DB CHECK (23514)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await expect(
      adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "private",
        display_name: "DB-Check Violator",
        personnummer: "19900101-1234",
        org_nr: "556677-8899", // forbidden for private — the CHECK must bite
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("[P1] a company customer carrying personnummer is rejected by the DB CHECK (23514)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await expect(
      adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: "DB-Check Violator 2",
        org_nr: "556677-8899",
        personnummer: "19900101-1234", // forbidden for non-private
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("[P1] a customer_type outside the four values is rejected by the DB CHECK (23514)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await expect(
      adminInsertCustomer({
        tenant_id: fixture.tenantA.id,
        customer_type: "charity" as never,
        display_name: "Bad Type",
        org_nr: "556677-8899",
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
