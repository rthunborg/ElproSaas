/**
 * Story 8.5 — file-index tenant-scoped listing + RLS NEGATIVE (AC1/AC3, P1 — 8.5-RLS-01/02,
 * R-801/R-810/R-816). The limited `Filer` index reads `file_links` → `files` across the Phase A
 * owner types on the per-request anon-key RLS client (NO tenant id passed, NEVER service-role); RLS
 * scopes every row to the caller's tenant. This suite proves the POSITIVE own-tenant set AND the
 * ABSENCE of any tenant-B row (not a vacuous `not.toContain` basename check — the deferred-work 8-1
 * weak-assertion lesson).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD) — every test is gated behind `describe.skip`. The `readFileIndex` cross-owner-type
 * read does NOT exist yet — Story 8.5 Task 1.1 ADDS it to `src/features/files/read.ts` as a SIBLING of
 * `readEntityFiles`. Because `readFileIndex` is cookie-bound (not injectable), the isolation proof runs
 * the EQUIVALENT query directly on the two-tenant fixture's authed anon-key RLS client (the same query
 * shape `readFileIndex` will run) — mirroring how `storage-object-isolation.rls.test.ts` proves the
 * plane at the client level. Remove `describe.skip` in dev-story green phase; if Task 1.1 exposes an
 * injectable read, swap the direct query for a `readFileIndex({ client })` call.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The proofs (test-design-epic-8.md P1 "(8.5) Limited-index tenant-scoped listing + RLS negative"):
 *   - 8.5-RLS-01 (P1, AC1/AC3): tenant A's index query returns ONLY tenant A file_links across SEVERAL
 *     Phase A owner types (customer/facility/contact/calculation/job) — the POSITIVE own-tenant set is
 *     exactly the seeded A rows, and NO tenant-B file/link id appears.
 *   - 8.5-RLS-02 (P1, AC3): a cross-tenant probe — tenant A filtering by a tenant-B owner_id — returns
 *     ZERO rows (RLS invisibility; no "exists but not yours" leak, R-809).
 *   - 8.5-RLS-03 (P1, AC1/R-810): the index projection NEVER selects `object_path`/`bucket_id` — the
 *     display-safe column set only (the R-810 no-raw-path discipline the read must preserve).
 *   - 8.5-RLS-04 (P1, AC1): ARCHIVED links/files are DROPPED from the index (the `.is('archived_at',
 *     null)` + lifecycle-state filter the read applies — an archived file is not listed).
 *
 * Harness conventions mirror `storage-object-isolation.rls.test.ts` + `file-link-lock.rls.test.ts`:
 * two-tenant fixture, per-run unique ids (`crypto.randomUUID()`, NEVER `Date.now()`), the anon-key RLS
 * client for the reads, BYPASSRLS seeding + readback via `adminInsert*`, LOCAL Supabase stack ONLY + a
 * visible per-test skip when unreachable, CI (`SUPABASE_TEST_REQUIRED=1`) HARD-FAILS so the isolation
 * proof is never silently skipped (the R-2 false-green gap). NO PII/orgnr in fixtures; display names are
 * anonymized metadata-shape only (R-819).
 *
 * [Source: story 8.5 AC1/AC3 + Task 1.1/3.1; test-design-epic-8.md (R-801 isolation, R-810 no raw path,
 *  R-816 index scope; P1 rows); architecture.md#6 (RLS is the tenant boundary — no tenant id in a query);
 *  src/features/files/read.ts (readEntityFiles — the sibling the index read mirrors);
 *  src/server/commands/files/validation.ts (ACTIVE_OWNER_TYPES — the Phase A owner set);
 *  tests/integration/rls/storage-object-isolation.rls.test.ts (the plane-level isolation template);
 *  tests/factories/tenants.ts (two-tenant + file/link seed + readback helpers);
 *  deferred-work.md#8-1 (assert positive own-tenant set + absence of foreign id, not a vacuous check)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertFile,
  adminInsertFileLink,
  type TwoTenantFixture,
  type TestServerClient,
  type FixtureTenant,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
// GREEN (Story 8.5 dev): the ACTIVE owner set is the single source of truth for the index read filter.
import { ACTIVE_OWNER_TYPES } from "@/server/commands/files/validation";

/** The display-safe columns the index read is allowed to select — NEVER object_path/bucket_id (R-810). */
const INDEX_SELECT =
  "id, file_id, owner_type, owner_id, created_at, files!inner(id, display_name, mime_type, size_bytes, lifecycle_state)";

let stackUp = false;
let fx: TwoTenantFixture;
let clientA: TestServerClient;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fx = await createTwoTenantFixture();
  clientA = await makeAuthedServerClient(fx.adminA);
});

afterAll(async () => {
  if (stackUp && fx) await cleanupFixture(fx);
});

/**
 * Seed a NON-ARCHIVED file linked to a `customer` owner in the given tenant (the simplest Phase A
 * owner type — the index lists it). Returns the file + link ids so the test can assert own-tenant
 * presence and cross-tenant absence. NO PII — an anonymized display name (R-819).
 */
async function seedCustomerFile(
  tenant: FixtureTenant,
): Promise<{ customerId: string; fileId: string; linkId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `idx-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const fileId = await adminInsertFile({
    tenant_id: tenant.id,
    display_name: `idx-fil-${crypto.randomUUID().slice(0, 8)}.pdf`,
    mime_type: "application/pdf",
    lifecycle_state: "linked",
  });
  const linkId = await adminInsertFileLink({
    tenant_id: tenant.id,
    file_id: fileId,
    owner_type: "customer",
    owner_id: customerId,
    purpose: "crm_document",
  });
  return { customerId, fileId, linkId };
}

/** Seed a NON-ARCHIVED file linked to a `calculation` owner (a second Phase A owner type in the index). */
async function seedCalculationFile(
  tenant: FixtureTenant,
): Promise<{ calcId: string; fileId: string; linkId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenant.id,
    customer_type: "company",
    display_name: `idx-calc-customer-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenant.id,
    customer_id: customerId,
    title: `idx-calc-${crypto.randomUUID().slice(0, 8)}`,
  });
  const fileId = await adminInsertFile({
    tenant_id: tenant.id,
    display_name: `idx-kalkyl-${crypto.randomUUID().slice(0, 8)}.pdf`,
    lifecycle_state: "linked",
  });
  const linkId = await adminInsertFileLink({
    tenant_id: tenant.id,
    file_id: fileId,
    owner_type: "calculation",
    owner_id: calcId,
    purpose: "calculation_attachment",
  });
  return { calcId, fileId, linkId };
}

/** Run the index read's EXACT query shape on an authed anon-key RLS client (mirrors readFileIndex). */
async function runIndexQuery(client: TestServerClient) {
  return client
    .from("file_links")
    .select(INDEX_SELECT)
    .in("owner_type", ACTIVE_OWNER_TYPES as unknown as string[])
    .is("archived_at", null)
    .order("created_at", { ascending: false });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-RLS-01 (P1, AC1/AC3) — tenant A's index lists ONLY tenant A files across several owner types
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-RLS-01: the limited index lists ONLY the caller's own-tenant files across Phase A owner types (AC1/AC3, R-801)", () => {
  it("[P1] 8.5-RLS-01: tenant A's index returns the seeded A file_links (customer + calculation) and NO tenant-B link/file id", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Seed A files across two owner types + a B file that must NEVER appear in A's index.
    const aCustomer = await seedCustomerFile(fx.tenantA);
    const aCalc = await seedCalculationFile(fx.tenantA);
    const bCustomer = await seedCustomerFile(fx.tenantB);

    const { data, error } = await runIndexQuery(clientA);
    expect(error).toBeNull();
    const rows = data ?? [];
    const linkIds = rows.map((r) => (r as { id: string }).id);
    const fileIds = rows.map((r) => (r as { file_id: string }).file_id);

    // POSITIVE own-tenant set: both A links appear.
    expect(linkIds).toContain(aCustomer.linkId);
    expect(linkIds).toContain(aCalc.linkId);
    // ABSENCE of the foreign id (not a vacuous basename check — assert the concrete B link/file id).
    expect(linkIds).not.toContain(bCustomer.linkId);
    expect(fileIds).not.toContain(bCustomer.fileId);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-RLS-02 (P1, AC3) — a cross-tenant owner-id probe returns ZERO rows (no existence disclosure)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-RLS-02: a cross-tenant owner-id filter on the index returns ZERO rows (RLS invisibility, no leak) (AC3, R-809)", () => {
  it("[P1] 8.5-RLS-02: tenant A filtering the index by a tenant-B owner_id returns an EMPTY set", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const bCustomer = await seedCustomerFile(fx.tenantB);

    // Even crafting B's exact owner_id, RLS scopes the read to A's tenant → zero rows, identical to a
    // not-found id (no "file exists but not yours" disclosure).
    const { data, error } = await clientA
      .from("file_links")
      .select(INDEX_SELECT)
      .in("owner_type", ACTIVE_OWNER_TYPES as unknown as string[])
      .eq("owner_id", bCustomer.customerId)
      .is("archived_at", null);

    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-RLS-03 (P1, AC1/R-810) — the index projection is display-safe (no raw object_path/bucket_id)
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-RLS-03: the index projection returns ONLY display-safe columns — NEVER object_path/bucket_id (AC1, R-810)", () => {
  it("[P1] 8.5-RLS-03: no listed row exposes object_path or bucket_id", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await seedCustomerFile(fx.tenantA);

    const { data, error } = await runIndexQuery(clientA);
    expect(error).toBeNull();
    const serialized = JSON.stringify(data ?? []);
    // The R-810 no-raw-path discipline: the projection must not carry the raw object/bucket identity.
    expect(serialized).not.toMatch(/object_path|bucket_id/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8.5-RLS-04 (P1, AC1) — archived links/files are DROPPED from the limited index
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe.skip("8.5-RLS-04: an ARCHIVED file/link is DROPPED from the index (the .is('archived_at', null) + lifecycle filter) (AC1)", () => {
  it("[P1] 8.5-RLS-04: after a file is archived (lifecycle_state='archived'), its link no longer appears in the index", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { fileId, linkId } = await seedCustomerFile(fx.tenantA);

    // Mark the file archived (the sanctioned soft-delete state the index must exclude).
    const { error: upErr } = await clientA
      .from("files")
      .update({ lifecycle_state: "archived" })
      .eq("id", fileId)
      .select();
    expect(upErr).toBeNull();

    const { data, error } = await runIndexQuery(clientA);
    expect(error).toBeNull();
    const linkIds = (data ?? []).map((r) => (r as { id: string }).id);
    // The archived file's link is excluded from the limited index.
    expect(linkIds).not.toContain(linkId);
  });
});
