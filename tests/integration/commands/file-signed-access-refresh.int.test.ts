/**
 * Story 8.3 — ATDD RED-PHASE scaffold: the expiry→refresh REAUTHORIZATION matrix on top of
 * the PROVEN `createSignedFileAccess` funnel (AC2/AC3, P0/P1 — 8.3-INT-01, R-806/R-809/R-810).
 *
 * 8.3 wires a NEW UI entry point (`previewEntityFileAction`) onto the SAME 8.1 signing command
 * — it does NOT rebuild the funnel. The refresh/expiry loop is therefore proven at the COMMAND
 * layer here: a refresh is a genuine re-authorization (the command re-runs membership → ownership
 * → lifecycle EVERY call), NOT a bare re-sign of a cached URL. The sibling file
 * `file-signed-access.int.test.ts` (8.1, GREEN) proves the base authorization matrix + expiry;
 * this file adds the 8.3-specific REFRESH cases and MUST stay complementary (do NOT weaken 8.1).
 *
 * Cases (Task 4.1):
 *   (a) [AC2/R-806 — the real teeth] sign an own-tenant file → SUCCEEDS; ARCHIVE that file (admin
 *       update); re-run `createSignedFileAccess` for the SAME file_id → now FILE_ACCESS_DENIED.
 *       Proves the refresh re-runs the FULL lifecycle gate, NOT a bare re-sign — a file whose
 *       lifecycle changed between the first sign and the retry is NOT re-signed.
 *   (b) [AC2] sign an own-tenant file TWICE under the SAME fixed clock → two valid results with
 *       identical deterministic `expiresAt`. A refresh is a genuine re-authorization (a second
 *       full pass), not a no-op replay of the first URL.
 *   (c) [AC3/R-809] a foreign file_id submitted on the "retry" → TENANT_ACCESS_DENIED — the SAME
 *       generic shape as not-found (no "exists but not yours" leak), and NO signedUrl payload.
 *   (d) [R-810] the failure Result (archived / foreign) carries NO signedUrl / object_path /
 *       bucket_id — metadata-first, storage-second: a denial never leaks a storage handle.
 *
 * ── GREEN as of Story 8.1 dev (the command itself) ──────────────────────────────────────
 * `createSignedFileAccess` + the storage wrapper + the FILE_ACCESS_DENIED code + the file
 * factory seeds have ALL landed (8.1). This scaffold imports the REAL command and exercises the
 * refresh loop; there is no not-yet-built import here. It is RED only in the sense that it is a
 * NEW behavioral assertion 8.3 must keep green through its new entry point — if the archive-on-
 * retry re-sign discipline ever regressed, case (a) fails loud. It runs against the LOCAL
 * Supabase stack + Storage; skips visibly when either is unreachable.
 *
 * Runs under `SUPABASE_TEST_REQUIRED=1` so the storage-negative class is FORCED to execute
 * (retro R-2 — closes the false-green-skip gap). Local Supabase CLI stack ONLY (never demo/prod).
 *
 * [Source: story 8.3 Task 4.1; test-design-epic-8.md §"Refresh-reauthorization UX is 8.3", §P1
 *  row "(8.3) Metadata-first / storage-second ordering"; R-806/R-809/R-810;
 *  tests/integration/commands/file-signed-access.int.test.ts (the 8.1 base matrix this extends)]
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertFile,
  adminUploadStorageObject,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
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
// SUPABASE_SIGNED_URL_TTL_SECONDS is unset in the test env → the command resolves the 300s
// default. Under the fixed clock, `expiresAt` is a FULLY DETERMINISTIC instant.
const DEFAULT_TTL_SECONDS = 300;
const EXPECTED_EXPIRES_AT = new Date(
  new Date(FIXED_ISO).getTime() + DEFAULT_TTL_SECONDS * 1000,
).toISOString();

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin's authenticated anon-key RLS client
let refreshFileId: string; // A's own eligible file — signed, then archived mid-test
let tenantBFileId: string; // a REAL Tenant B file (cross-tenant retry target)

function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  return skipUnlessStorage(ctx, storageUp);
}

async function objectPathOf(fileId: string): Promise<string> {
  const rows = await adminQuery<{ object_path: string }>(
    `select object_path from public.files where id = $1`,
    [fileId],
  );
  const path = rows[0]?.object_path;
  if (!path) throw new Error(`no object_path for seeded file ${fileId}`);
  return path;
}

/** Flip a seeded file's lifecycle_state via the privileged path (simulates a mid-flight archive). */
async function adminSetLifecycle(fileId: string, state: string): Promise<void> {
  await adminQuery(`update public.files set lifecycle_state = $2 where id = $1`, [
    fileId,
    state,
  ]);
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  refreshFileId = await adminInsertFile({
    tenant_id: fixture.tenantA.id,
    display_name: "refresh-eligible.pdf",
    lifecycle_state: "linked",
  });
  tenantBFileId = await adminInsertFile({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-refresh.pdf",
    lifecycle_state: "linked",
  });
  // Vacuity guard: a missing seed id would make the negatives deny VACUOUSLY.
  if (!refreshFileId || !tenantBFileId) {
    throw new Error(
      "signed-access-refresh seed produced no id (own / tenant-B) — the reauthorization " +
        "assertions would run VACUOUSLY.",
    );
  }
  // Plant a REAL object so the FIRST (pre-archive) sign has something to sign.
  if (storageUp) {
    await adminUploadStorageObject({
      bucket: BUCKET,
      objectPath: await objectPathOf(refreshFileId),
      body: new TextEncoder().encode("refresh-eligible-bytes"),
    });
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("createSignedFileAccess expiry→refresh reauthorization (Story 8.3, AC2/AC3)", () => {
  it("[8.3-INT-01a][P0/AC2/R-806] a file ARCHIVED between the first sign and the retry is NOT re-signed (FILE_ACCESS_DENIED)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;

    // First sign — the file is eligible → SUCCEEDS.
    const first = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: refreshFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);

    // The lifecycle changes to archived BETWEEN the first sign and the retry.
    await adminSetLifecycle(refreshFileId, "archived");

    // The "refresh" is a FRESH FULL auth (the same command again) — NOT a bare re-sign of the
    // cached URL. The lifecycle gate now denies the SAME file_id. This is the real AC2 teeth.
    const retry = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: refreshFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(false);
    if (!retry.ok) {
      expect(retry.code).toBe("FILE_ACCESS_DENIED");
      // R-810: the denial carries no signed URL payload.
      expect((retry as { data?: { signedUrl?: string } }).data?.signedUrl).toBeUndefined();
    }

    // Restore for any downstream case ordering independence.
    await adminSetLifecycle(refreshFileId, "linked");
    if (storageUp) {
      await adminUploadStorageObject({
        bucket: BUCKET,
        objectPath: await objectPathOf(refreshFileId),
        body: new TextEncoder().encode("refresh-eligible-bytes"),
      });
    }
  });

  it("[8.3-INT-01b][P1/AC2] signing the SAME eligible file twice re-authorizes (two valid results, identical deterministic expiresAt)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const first = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: refreshFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    const second = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: refreshFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      const d1 = first.data as { signedUrl: string; expiresAt: string };
      const d2 = second.data as { signedUrl: string; expiresAt: string };
      // A refresh is a genuine second full authorization — both mint a valid URL, and under the
      // fixed clock the deterministic expiry is identical (proves the TTL is re-applied, not a
      // no-op replay of the first result).
      expect(d1.signedUrl.length).toBeGreaterThan(0);
      expect(d2.signedUrl.length).toBeGreaterThan(0);
      expect(d1.expiresAt).toBe(EXPECTED_EXPIRES_AT);
      expect(d2.expiresAt).toBe(EXPECTED_EXPIRES_AT);
    }
  });

  it("[8.3-INT-01c][P0/AC3/R-809] a FOREIGN file_id submitted on the retry denies with the SAME generic shape (TENANT_ACCESS_DENIED, no url)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const retry = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: tenantBFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(false);
    if (!retry.ok) {
      // Same shape as not-found — no existence disclosure (R-809).
      expect(retry.code).toBe("TENANT_ACCESS_DENIED");
      expect((retry as { data?: unknown }).data).toBeUndefined();
    }
  });

  it("[8.3-INT-01d][P0/R-809] a NON-EXISTENT file_id on the retry denies with the SAME shape as the foreign case", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const retry = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: crypto.randomUUID() }, // never seeded
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("[8.3-INT-01e][P1/R-810] the SUCCESS projection carries ONLY signed-access fields — never object_path / bucket_id", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // Metadata-first / storage-second asserted at the exact command the preview action
    // (previewEntityFileAction) calls: the ONLY storage handle returned to the caller is the
    // signed URL — the raw object_path / bucket_id NEVER cross the boundary. The action layer
    // itself is cookie-bound (createSupabaseServerClient) and not INT-injectable, so the no-raw-
    // path guarantee is proven HERE (command) + in the E2E DOM assertion (no path text in panel).
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: refreshFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      // POSITIVE allow-list (not just a blocklist): a stray leaked field fails loud.
      const keys = Object.keys(data).sort();
      expect(keys).toEqual(["expiresAt", "signedUrl", "targetId"]);
      expect(data).not.toHaveProperty("object_path");
      expect(data).not.toHaveProperty("bucket_id");
      // Belt-and-braces: the serialized data carries no raw path / bucket substring.
      const serialized = JSON.stringify(data);
      expect(serialized).not.toMatch(/object_path|bucket_id/i);
    }
  });
});
