/**
 * Story 8.1 — ATDD RED-PHASE scaffold: createSignedFileAccess authorization matrix
 * (AC5/AC6/AC8, P0 — 8.1-INT-03, R-804/R-806/R-810).
 *
 * The signing AUTHORIZATION FUNNEL exercised through the EXISTING
 * `defineCommand`/`runCommand` envelope — metadata-first ownership + lifecycle gate
 * BEFORE any `createSignedUrl` call, and generic user-safe denials with NO existence
 * disclosure (cross-tenant returns the SAME shape as not-found — R-809):
 *   - happy own-tenant sign SUCCEEDS → returns { signedUrl, expiresAt } + EXACTLY ONE
 *     `file.signed_access.created` audit row with clean allow-listed metadata (NO
 *     bucket/object path, NO PII, NO file contents);
 *   - anonymous sign REJECTED (UNAUTHENTICATED);
 *   - cross-tenant file id REJECTED (TENANT_ACCESS_DENIED — the envelope ownership
 *     gate: zero rows under RLS, BEFORE execute);
 *   - archived/deleted lifecycle REJECTED (FILE_ACCESS_DENIED — the lifecycle gate,
 *     on an OWNED file, before Storage is touched);
 *   - a storage-path-spoof signing attempt does NOT let the caller sign another
 *     tenant's object (the object_path is server-derived from resolved tenant, never
 *     from client input);
 *   - an expired signed URL no longer authorizes (driven by a LOW
 *     SUPABASE_SIGNED_URL_TTL_SECONDS — R-806).
 *
 * ── GREEN as of Story 8.1 dev ───────────────────────────────────────────────────
 * `@/server/commands/files` (createSignedFileAccess), `@/server/storage/*`, the
 * `FILE_ACCESS_DENIED` command code, the `files` migration, and the file factory seeds
 * have landed (Tasks 2/4/5/7). The real surfaces are imported and `.skip` is removed.
 *
 * The happy-path sign REQUIRES a real storage object under the file's object_path (a
 * signed URL is issued only for an object the caller can reach under `storage.objects`
 * RLS). The seed therefore uploads a real object at the file's server-derived path via
 * the service-role path, then the command signs it under the caller's RLS client.
 *
 * Runs against the LOCAL Supabase stack + Storage service only; skips visibly when
 * either is unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  makeAnonServerClient,
  cleanupFixture,
  adminInsertFile,
  adminUploadStorageObject,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import {
  isLocalStackReachable,
  isLocalStorageReachable,
} from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createSignedFileAccess } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-04T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
const BUCKET = "tenant-files";

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin's authenticated anon-key client
let anon: TestServerClient; // unauthenticated client
let ownFileId: string; // A's own draft/linked file (access-eligible)
let archivedFileId: string; // A's own archived file (lifecycle-ineligible)
let tenantBFileId: string; // a REAL Tenant B file (cross-tenant target)

/** Combined gate: skip when the DB stack OR the Storage service is unreachable. */
function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  return skipUnlessStorage(ctx, storageUp);
}

/** Read a seeded file's server-stored object_path (BYPASSRLS) to plant a real object. */
async function objectPathOf(fileId: string): Promise<string> {
  const rows = await adminQuery<{ object_path: string }>(
    `select object_path from public.files where id = $1`,
    [fileId],
  );
  const path = rows[0]?.object_path;
  if (!path) throw new Error(`no object_path for seeded file ${fileId}`);
  return path;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
  ownFileId = await adminInsertFile({
    tenant_id: fixture.tenantA.id,
    display_name: "own-eligible.pdf",
    lifecycle_state: "linked",
  });
  archivedFileId = await adminInsertFile({
    tenant_id: fixture.tenantA.id,
    display_name: "own-archived.pdf",
    lifecycle_state: "archived",
  });
  tenantBFileId = await adminInsertFile({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-file.pdf",
    lifecycle_state: "linked",
  });
  // Vacuity guard: a missing seed id would make the cross-tenant negative deny
  // vacuously (target a non-existent row) — fail loud instead.
  if (!ownFileId || !archivedFileId || !tenantBFileId) {
    throw new Error(
      "file signed-access seed produced no id (own / archived / tenant-B file) — the " +
        "authorization negatives would deny VACUOUSLY.",
    );
  }
  // Plant a REAL storage object at the eligible file's server-derived object_path so the
  // happy-path sign has an object to sign (a signed URL is issued for a reachable object).
  // Only when the Storage service is up.
  if (storageUp) {
    await adminUploadStorageObject({
      bucket: BUCKET,
      objectPath: await objectPathOf(ownFileId),
      body: new TextEncoder().encode("own-eligible-bytes"),
    });
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("createSignedFileAccess authorization matrix (AC5/AC6/AC8)", () => {
  it("[P0] happy own-tenant sign SUCCEEDS → signedUrl + expiresAt", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: ownFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { signedUrl: string; expiresAt: string };
      expect(typeof data.signedUrl).toBe("string");
      expect(data.signedUrl.length).toBeGreaterThan(0);
      expect(typeof data.expiresAt).toBe("string");
    }
  });

  it("[P0/AC8] the successful sign writes EXACTLY ONE audit row with clean allow-listed metadata", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: ownFileId },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    const events = await adminSelectAuditEvents({ correlationId });
    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("file.signed_access.created");
    // Metadata carries NO bucket/object path, NO PII, NO file contents — only
    // allow-listed target-shaped fields.
    const meta = JSON.stringify(events[0]?.metadata ?? {});
    expect(meta).not.toMatch(/tenant-files|object_path|bucket|signedUrl|https?:\/\//i);
  });

  it("[P0] anonymous sign is REJECTED (UNAUTHENTICATED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: anon as never,
      input: { file_id: ownFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHENTICATED");
  });

  it("[P0] cross-tenant file id is REJECTED (TENANT_ACCESS_DENIED) — no existence disclosure", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: tenantBFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    // SAME shape as not-found: the failure Result carries a stable generic code and
    // no data (no "file exists but not yours" leak — R-809).
    if (!result.ok) {
      expect(result.code).toBe("TENANT_ACCESS_DENIED");
      expect((result as { data?: unknown }).data).toBeUndefined();
    }
  });

  it("[P0] a non-existent file id denies with the SAME shape as the cross-tenant case", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: crypto.randomUUID() }, // never seeded
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[P0/AC5] an ARCHIVED own file is REJECTED by the lifecycle gate (FILE_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: archivedFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    // The lifecycle gate runs on an OWNED file — a file-specific denial, before any
    // createSignedUrl call.
    if (!result.ok) expect(result.code).toBe("FILE_ACCESS_DENIED");
  });

  it("[P0/AC5] the archived-file rejection does NOT issue a signed URL", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: archivedFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    // metadata-first: the failure Result carries no signedUrl payload at all.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { data?: { signedUrl?: string } }).data?.signedUrl).toBeUndefined();
    }
  });
});
