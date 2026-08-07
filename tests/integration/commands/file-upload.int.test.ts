/**
 * Story 8.2 — ATDD RED-PHASE scaffold: the `uploadFile` command server-side gate +
 * storage↔DB compensation (AC2/AC4/AC5, P0/P1 — 8.2-INT-01..04, R-807/R-808/R-809/R-814).
 *
 * The generic USER-FACING upload path: choose a file → server-validate MIME/size/owner/
 * purpose/lifecycle → write the private object (tenant-first server-derived path) → persist
 * `files` (lifecycle_state='linked') + a `file_links` row, with the 6.3 PDF pipeline's
 * VERIFIED-COMPENSATED discipline (id-up-front → object write → metadata; a metadata failure
 * after the object write compensates rather than leaving a usable orphan).
 *
 * Runs through the EXISTING `defineCommand`/`runCommand` envelope on the CALLER's request-bound
 * RLS client (anon key — NEVER service-role). The envelope ownership gate verifies the OWNER
 * record (the entity being attached to) is visible under the caller's RLS (R-802 owner-side): a
 * foreign owner id ⇒ zero rows ⇒ TENANT_ACCESS_DENIED.
 *
 * Coverage (mapped to test-design-epic-8.md §P0/P1 + story Task 6):
 *   - 8.2-INT-01 (P0, AC2/AC5): a VALID upload SUCCEEDS own-tenant — a `files` row
 *     (lifecycle_state='linked') + a `file_links` row bound to the owner + the object present.
 *     Parametrized across the ACTIVE owner types (customer/facility/contact/calculation/
 *     quote_acceptance/job) — mirrors file-link-ownership.int.test.ts's describe.each.
 *   - 8.2-INT-02 (P0, AC2): a BLOCKED MIME + an OVERSIZED upload are rejected VALIDATION_FAILED
 *     SERVER-SIDE even when the client is bypassed (not client-only validation — R-808).
 *   - 8.2-INT-03 (P0, AC2/R-802): a FOREIGN owner id (Tenant B) is rejected TENANT_ACCESS_DENIED.
 *   - 8.2-INT-04 (P0, R-809): a cross-tenant owner id AND a genuinely non-existent owner id return
 *     the SAME generic TENANT_ACCESS_DENIED shape (no signal distinguishing them).
 *   - 8.2-INT-05 (P1, AC4/R-807): a DB failure injected AFTER a successful object upload leaves a
 *     CONSISTENT, retryable state — NO usable files/file_links row over a stored object (or the
 *     orphan is archived, never hard-deleted — archive-over-delete), and a real retry SUCCEEDS.
 *
 * ── RED until Story 8.2 dev lands `uploadFile` (Task 3) + its exports (Task 3.6) ─────────
 * Imports the not-yet-created `uploadFile` command + the `UploadFileInput` type. Compile/
 * import-fails until Task 3 adds `uploadFile = defineCommand<...>` to files.ts and exports it
 * from files/index.ts. The compensation seam (8.2-INT-05) reuses the 6.3 `withFailingUpload`
 * proxy shape but injects the fault at the METADATA write (after the object write) — the exact
 * proxy target depends on the Task-3 helper (`upload-object.ts`); if dev derives the object path
 * differently, adjust the proxy, not the CONSISTENCY assertion.
 *
 * Runs against the LOCAL Supabase stack + Storage ONLY; skips visibly when unreachable;
 * SUPABASE_TEST_REQUIRED=1 hard-fails a missing stack + FORCES the storage-negative class to run
 * (closes the R-2 false-green gap — epic-8 retro). Fixture BYTES are generated at TEST TIME
 * (never committed as customer data — R-819).
 *
 * [Source: test-design-epic-8.md §P0 (R-808/R-809), §P1 (R-807); story 8.2 Task 3 + Task 6;
 *  src/server/commands/quotes/generate-pdf.ts:205-322 (the canonical object-byte upload +
 *  compensation reference); tests/integration/commands/file-link-ownership.int.test.ts
 *  (the describe.each R-802 shape); generate-quote-pdf-retry-consistency.int.test.ts
 *  (the withFailingUpload proxy + consistency shape); epics.md 8.2 AC2/AC4/AC5]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertCalculation,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteAcceptance,
  adminInsertJob,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable, isLocalStorageReachable } from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { uploadFile } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-07T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

// ── TEST-TIME fixture bytes (never committed customer data — R-819) ────────────────────
/** A minimal valid PDF (`%PDF-1.4` magic) generated at test time. */
function validPdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4\n% test fixture — not customer data\n%%EOF\n");
}
/** A blocked-type payload (an "executable" MIME the allow-list rejects). */
function blockedTypeBytes(): Uint8Array {
  return new TextEncoder().encode("MZ blocked-type fixture\n");
}
/** An oversized payload (> the conservative dev max — 60 MiB of zero bytes). */
function oversizedBytes(): Uint8Array {
  return new Uint8Array(60 * 1024 * 1024);
}

/** Build the FormData-equivalent command input the action would produce (Task 4.2). */
function uploadInput(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    owner_type: "customer",
    owner_id: "",
    purpose: "crm_document",
    display_name: `fixture-${crypto.randomUUID()}.pdf`,
    mime_type: "application/pdf",
    size_bytes: validPdfBytes().byteLength,
    bytes: validPdfBytes(),
    ...overrides,
  };
}

/**
 * Wrap the RLS client so the `files` METADATA insert fails AFTER a successful object upload —
 * the R-807 storage-success / DB-failure seam. Every other surface (auth/ownership/storage
 * upload) delegates to the real client, so the object DOES get written and the compensation
 * path is the only thing under test. The exact seam depends on the Task-3 helper; this proxy
 * fails the `.from("files").insert(...)` call.
 */
function withFailingMetadataInsert(client: TestServerClient): TestServerClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const realBuilder = (target as never as { from: (t: string) => unknown }).from(table);
          if (table !== "files") return realBuilder;
          return new Proxy(realBuilder as object, {
            get(bt, bp, br) {
              if (bp === "insert") {
                return () => ({
                  select: () => ({
                    single: async () => ({
                      data: null,
                      error: { message: "injected metadata insert fault", code: "XX000" },
                    }),
                  }),
                  // Some call shapes await the insert directly.
                  then: (resolve: (v: unknown) => void) =>
                    resolve({ data: null, error: { message: "injected metadata insert fault" } }),
                });
              }
              return Reflect.get(bt, bp, br);
            },
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as TestServerClient;
}

interface OwnerTypeCase {
  readonly ownerType: "customer" | "facility" | "contact" | "calculation" | "quote_acceptance" | "job";
  readonly purpose: string;
  readonly ownId: () => string;
  readonly foreignId: () => string;
  /**
   * The lifecycle_state the uploaded file lands in. Story 8.4 CHANGE: an `acceptance_evidence`
   * upload to a COMMITTED acceptance (the parent already exists — AR704 has no draft state) is
   * LOCKED by the parent-state-keyed lock apply (`apply_file_link_lock`), so its file lands
   * `locked`, not `linked`. Every OTHER active owner/purpose (crm_document / calculation_attachment
   * / job_evidence) is NOT a lock-family member, so it stays `linked` (8.2's draft→linked transition).
   */
  readonly expectedLifecycle: "linked" | "locked";
}

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient;

// A's own owner records across every ACTIVE owner type + a matching Tenant-B foreign owner.
let ownCustomerId: string;
let ownFacilityId: string;
let ownContactId: string;
let ownCalculationId: string;
let ownAcceptanceId: string;
let ownJobId: string;
let bCustomerId: string;
let bFacilityId: string;
let bContactId: string;
let bCalculationId: string;
let bAcceptanceId: string;
let bJobId: string;

function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  return skipUnlessStorage(ctx, storageUp);
}

/** Seed a full acceptance+job chain (quote→version→acceptance→job) for a tenant. */
async function seedAcceptanceAndJob(
  tenantId: string,
  customerId: string,
  calculationId: string,
): Promise<{ acceptanceId: string; jobId: string }> {
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    status: "sent",
    accepted_price_ore: 125000,
  });
  const acceptanceId = await adminInsertQuoteAcceptance({
    tenant_id: tenantId,
    quote_id: quoteId,
    quote_version_id: versionId,
  });
  const jobId = await adminInsertJob({
    tenant_id: tenantId,
    quote_acceptance_id: acceptanceId,
    quote_version_id: versionId,
    customer_id: customerId,
  });
  return { acceptanceId, jobId };
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  storageUp = await isLocalStorageReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);

  ownCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "company",
    display_name: "tenant-a-owner",
    org_nr: "556000-4444",
  });
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
  ({ acceptanceId: ownAcceptanceId, jobId: ownJobId } = await seedAcceptanceAndJob(
    fixture.tenantA.id,
    ownCustomerId,
    ownCalculationId,
  ));

  bCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-owner",
    org_nr: "556000-5555",
  });
  bFacilityId = await adminInsertFacility({
    tenant_id: fixture.tenantB.id,
    customer_id: bCustomerId,
    name: "tenant-b-facility",
  });
  bContactId = await adminInsertContact({
    tenant_id: fixture.tenantB.id,
    customer_id: bCustomerId,
    name: "tenant-b-contact",
  });
  bCalculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantB.id,
    customer_id: bCustomerId,
  });
  ({ acceptanceId: bAcceptanceId, jobId: bJobId } = await seedAcceptanceAndJob(
    fixture.tenantB.id,
    bCustomerId,
    bCalculationId,
  ));

  const seeded = [
    ownCustomerId, ownFacilityId, ownContactId, ownCalculationId, ownAcceptanceId, ownJobId,
    bCustomerId, bFacilityId, bContactId, bCalculationId, bAcceptanceId, bJobId,
  ];
  if (seeded.some((id) => !id)) {
    throw new Error(
      "file-upload seed produced no id — the both-side negatives would deny VACUOUSLY.",
    );
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

const ownerTypeCases: OwnerTypeCase[] = [
  { ownerType: "customer", purpose: "crm_document", ownId: () => ownCustomerId, foreignId: () => bCustomerId, expectedLifecycle: "linked" },
  { ownerType: "facility", purpose: "crm_document", ownId: () => ownFacilityId, foreignId: () => bFacilityId, expectedLifecycle: "linked" },
  { ownerType: "contact", purpose: "crm_document", ownId: () => ownContactId, foreignId: () => bContactId, expectedLifecycle: "linked" },
  { ownerType: "calculation", purpose: "calculation_attachment", ownId: () => ownCalculationId, foreignId: () => bCalculationId, expectedLifecycle: "linked" },
  // Story 8.4: acceptance evidence uploaded to a committed acceptance locks by construction.
  { ownerType: "quote_acceptance", purpose: "acceptance_evidence", ownId: () => ownAcceptanceId, foreignId: () => bAcceptanceId, expectedLifecycle: "locked" },
  { ownerType: "job", purpose: "job_evidence", ownId: () => ownJobId, foreignId: () => bJobId, expectedLifecycle: "linked" },
];

describe("uploadFile — server-side gate + storage↔DB compensation (AC2/AC4/AC5)", () => {
  describe.each(ownerTypeCases)(
    "active owner type: $ownerType",
    ({ ownerType, purpose, ownId, foreignId, expectedLifecycle }) => {
      it(`[8.2-INT-01][P0/AC2/AC5] a VALID upload SUCCEEDS own-tenant (files linked/locked + file_links row + object present)`, async (testCtx) => {
        if (skipUnlessBoth(testCtx)) return;
        const result = await runCommand(uploadFile as never, {
          client: a as never,
          input: uploadInput({ owner_type: ownerType, owner_id: ownId(), purpose }),
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const fileId = (result.data as { fileId: string }).fileId;
        // The files row landed lifecycle_state='linked' (8.2's draft→linked transition) — OR 'locked'
        // for acceptance_evidence on a committed acceptance (Story 8.4 parent-state-keyed lock apply).
        const fileRows = await adminQuery<{ lifecycle_state: string; object_path: string }>(
          `select lifecycle_state, object_path from public.files where id = $1`,
          [fileId],
        );
        expect(fileRows[0]?.lifecycle_state).toBe(expectedLifecycle);
        // The object path is tenant-first, server-derived (never a client path).
        expect(fileRows[0]?.object_path.startsWith(`${fixture.tenantA.id}/`)).toBe(true);
        // Exactly one file_links row binds the file to this owner + purpose.
        const links = await adminQuery<{ n: string }>(
          `select count(*)::text as n from public.file_links
             where file_id = $1 and owner_type = $2 and owner_id = $3 and purpose = $4`,
          [fileId, ownerType, ownId(), purpose],
        );
        expect(Number(links[0]?.n)).toBe(1);
      });

      it(`[8.2-INT-03][P0/R-802] a FOREIGN ${ownerType} owner id is rejected TENANT_ACCESS_DENIED`, async (testCtx) => {
        if (skipUnlessBoth(testCtx)) return;
        const result = await runCommand(uploadFile as never, {
          client: a as never,
          input: uploadInput({ owner_type: ownerType, owner_id: foreignId(), purpose }),
          clock: fixedClock,
          correlationId: crypto.randomUUID(),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
      });
    },
  );

  it("[8.2-INT-02][P0/AC2/R-808] a BLOCKED MIME is rejected VALIDATION_FAILED server-side (client bypassed)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // The client is "bypassed": a blocked-type payload declared as a permitted mime — the
    // server re-derives/re-validates and rejects it regardless of the client claim.
    const bytes = blockedTypeBytes();
    const result = await runCommand(uploadFile as never, {
      client: a as never,
      input: uploadInput({
        owner_type: "customer",
        owner_id: ownCustomerId,
        mime_type: "application/x-msdownload",
        display_name: `blocked-${crypto.randomUUID()}.exe`,
        size_bytes: bytes.byteLength,
        bytes,
      }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[8.2-INT-02][P0/AC2/R-808] an OVERSIZED upload is rejected VALIDATION_FAILED server-side", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const bytes = oversizedBytes();
    const result = await runCommand(uploadFile as never, {
      client: a as never,
      input: uploadInput({
        owner_type: "customer",
        owner_id: ownCustomerId,
        size_bytes: bytes.byteLength,
        bytes,
      }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[8.2-INT-04][P0/R-809] a cross-tenant owner AND a non-existent owner return the SAME generic denial (no existence disclosure)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const crossTenant = await runCommand(uploadFile as never, {
      client: a as never,
      input: uploadInput({ owner_type: "customer", owner_id: bCustomerId, purpose: "crm_document" }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    const nonExistent = await runCommand(uploadFile as never, {
      client: a as never,
      input: uploadInput({ owner_type: "customer", owner_id: crypto.randomUUID(), purpose: "crm_document" }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(crossTenant.ok).toBe(false);
    expect(nonExistent.ok).toBe(false);
    // IDENTICAL generic shape — the UI can never distinguish "a foreign file exists" from
    // "nothing exists" (R-809). Pin the exact code so a future silent drift fails CI.
    if (!crossTenant.ok && !nonExistent.ok) {
      expect(crossTenant.code).toBe("TENANT_ACCESS_DENIED");
      expect(nonExistent.code).toBe(crossTenant.code);
    }
  });

  it("[8.2-INT-05][P1/AC4/R-807] a metadata failure AFTER the object write leaves a CONSISTENT retryable state (no usable orphan)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const displayName = `compensate-${crypto.randomUUID()}.pdf`;
    const bytes = validPdfBytes();

    // Inject a DB metadata-insert fault AFTER the object upload succeeds.
    const failed = await runCommand(uploadFile as never, {
      client: withFailingMetadataInsert(a) as never,
      input: uploadInput({
        owner_type: "customer",
        owner_id: ownCustomerId,
        purpose: "crm_document",
        display_name: displayName,
        size_bytes: bytes.byteLength,
        bytes,
      }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(failed.ok).toBe(false);
    // A storage-success / DB-failure is a TRANSIENT retryable SERVER_ERROR — never a denial.
    if (!failed.ok) expect(failed.code).toBe("SERVER_ERROR");

    // No usable files row survived over the stored object (archive-over-delete: the orphaned
    // OBJECT may be left/archived, but NO committed-usable `files`/`file_links` row points at it).
    const orphanFiles = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.files
         where display_name = $1 and lifecycle_state in ('linked','draft')`,
      [displayName],
    );
    expect(Number(orphanFiles[0]?.n)).toBe(0);
    const orphanLinks = await adminQuery<{ n: string }>(
      `select count(*)::text as n from public.file_links fl
         join public.files f on f.id = fl.file_id
         where f.display_name = $1`,
      [displayName],
    );
    expect(Number(orphanLinks[0]?.n)).toBe(0);

    // The state is RETRYABLE — a subsequent real upload SUCCEEDS.
    const retry = await runCommand(uploadFile as never, {
      client: a as never,
      input: uploadInput({
        owner_type: "customer",
        owner_id: ownCustomerId,
        purpose: "crm_document",
        display_name: `retry-${crypto.randomUUID()}.pdf`,
        size_bytes: bytes.byteLength,
        bytes,
      }),
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(true);
  });
});
