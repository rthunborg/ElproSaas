/**
 * Story 6.3 — 6.3-INT-02 (P0, AC3): PDF STORAGE PRIVACY through the 8.1 file foundation.
 *
 * The generated PDF is a PRIVATE customer-facing document (HIGH security impact). This proves:
 *   - it is stored via the 8.1 foundation (private `tenant-files` bucket, SERVER-derived
 *     tenant-first object path via `deriveObjectPath` — no client path trusted);
 *   - a `files` metadata row + a `file_links` row (`owner_type='quote_version'`,
 *     `owner_id=<quote_version_id>`, `purpose='quote_pdf'`) are written atomically via
 *     `create_file_with_link`, PLUS a `quote_events` lifecycle row + an `audit_events` row;
 *   - a CROSS-TENANT and an ANON attempt to access the PDF file/metadata is REJECTED
 *     (generic access-denied — no cross-tenant existence leak); NO public URL surface;
 *   - the upload + signing run on the per-request RLS client (anon key — NEVER service-role,
 *     the containment guard); the audit metadata is `{ targetId }` only (no PII/money/URL).
 *
 * 6.3 does NOT invent its own file/storage/metadata model (a Stop Condition) and 6.3 is the
 * FIRST story to write actual object BYTES (8.1 was metadata-first; the general upload path
 * is Story 8.2) — done on the RLS-client `storage` surface, recorded as an 8.2-reconcile
 * deferral.
 *
 * ── ATDD RED PHASE ──────────────────────────────────────────────────────────────────
 * `generateQuotePdf` + its upload/metadata pipeline do NOT exist yet. `describe.skip`'d
 * with a red-phase note. When Task 4.2/4.3 land: wire the real command + the storage
 * readback helpers, remove `.skip`, and flip GREEN. LOCAL stack only (db reset + health poll);
 * `skipUnlessStack` visible-skips a stack-down run; CI hard-fails (SUPABASE_TEST_REQUIRED=1).
 *
 * [Source: test-design-epic-6.md#6.3-INT-02, R-611/R-614; story 6.3 Task 4.2/4.3 + Task 6.2;
 *  architecture.md#12/#14 (private bucket, server-derived paths, files/file_links,
 *  purpose=quote_pdf, owner_type=quote_version, generic access-denied for cross-tenant);
 *  src/server/storage/{object-path,signed-access}.ts; supabase/migrations/20260704120000_file_storage_foundation.sql
 *  (create_file_with_link + purpose/owner_type unions); tests/integration/commands/file-signed-access.int.test.ts
 *  + file-link-ownership.int.test.ts (the 8.1 storage-privacy precedents this mirrors)]
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

// RED PHASE — wire when Task 4 lands:
//   import { runCommand } from "@/server/commands/envelope";
//   import { generateQuotePdf } from "@/server/commands/quotes";
//   import { createSignedFileAccess } from "@/server/commands/files/files";
//   import { adminSelectFileLinks, adminSelectFiles, adminSelectQuoteEvents } from "../../factories/tenants";
//   import { adminSelectAuditEvents } from "../../factories/audit-events";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin (the generator)
let b: TestServerClient; // Tenant B admin (the cross-tenant intruder)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  b = await makeAuthedServerClient(fixture.adminB);
});
afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe.skip("generateQuotePdf — storage privacy (AC3, 6.3-INT-02) [ATDD red phase: command not implemented]", () => {
  it("[P0] the PDF is stored via the 8.1 foundation with files/file_links + quote_event + audit, all consistent", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // 1. Seed a snapshotted version, generate the PDF (success).
    // 2. Assert a `files` row exists (mime='application/pdf', private bucket, server-derived path).
    // 3. Assert a `file_links` row: owner_type='quote_version', owner_id=version.id, purpose='quote_pdf'.
    // 4. Assert a `quote_events` row (pdf_generated) + an `audit_events` row ({ targetId } only —
    //    no PII/money/customer values, no signed URL logged).
    // 5. Assert quote_versions.pdf_status='generated', pdf_file_id set, pdf_generated_at = the injected instant.
    expect.fail("ATDD red phase: implement generateQuotePdf storage pipeline (story 6.3 Task 4.2/4.3)");
  });

  it("[P0] a CROSS-TENANT caller cannot read the PDF file/metadata (generic access-denied, no existence leak)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Tenant A generates the PDF; Tenant B attempts createSignedFileAccess on A's file id →
    // denied at the DB (storage.objects RLS + composite same-tenant FKs), generic message —
    // no 23503/42501/SQL/tenant-existence signal.
    expect.fail("ATDD red phase: implement generateQuotePdf + prove cross-tenant denial (story 6.3 Task 5.2)");
  });

  it("[P0] an ANON caller cannot read the PDF file/metadata; there is NO public URL surface", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Access via an unauthenticated (anon) client is rejected; the signed URL is short-lived
    // (TTL-clamped from SUPABASE_SIGNED_URL_TTL_SECONDS) and never a public URL.
    expect.fail("ATDD red phase: implement generateQuotePdf + prove anon denial + signed-only access (story 6.3 Task 5.2)");
  });

  it("[P0] a foreign quote_version_id → TENANT_ACCESS_DENIED before any render/upload (envelope ownership gate)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Tenant A calls generateQuotePdf with a Tenant-B version id → TENANT_ACCESS_DENIED BEFORE
    // execute; nothing rendered, uploaded, or persisted.
    expect.fail("ATDD red phase: implement generateQuotePdf ownership gate (story 6.3 Task 4.1)");
  });
});
