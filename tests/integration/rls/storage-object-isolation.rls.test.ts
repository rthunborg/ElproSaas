/**
 * Story 8.1 — ATDD RED-PHASE scaffold: storage.objects tenant-path isolation
 * (AC4/AC6, P0 — 8.1-RLS-01, R-805/R-806). THE NEW STORAGE-PLANE NEGATIVE CLASS.
 *
 * The metadata-INDEPENDENT storage-plane isolation matrix — `storage.objects` RLS
 * scoped by the first path segment (the tenant id). This is a NEW test class Epic 8
 * introduces: there is NO H4-style auto gate for it (retro-note R-2), so it is
 * authored deliberately here:
 *   - seed a Tenant-B object under `{tenantB.id}/…` via the service-role path;
 *   - Tenant A (authed anon-key client) CANNOT list/read/sign it;
 *   - a PATH SPOOF — Tenant A signing `{tenantB.id}/…` directly — is denied by
 *     `storage.objects` RLS (the object_path first segment does not match A's tenant);
 *   - a MALFORMED (non-uuid) first segment fails the `::uuid` cast → denied;
 *   - anon cannot list/read/sign any object;
 *   - an EXPIRED signed URL no longer authorizes (LOW SUPABASE_SIGNED_URL_TTL_SECONDS —
 *     R-806).
 *
 * ── STORAGE-REACHABILITY PROBE (Task 8.6 — retro-note R-2 gap) ───────────────────
 * The existing `isLocalStackReachable()` probes ONLY `/auth/v1/health`; a storage
 * suite that relied on it would FALSE-GREEN (skip silently) when the DB is up but the
 * Storage service is down. This suite therefore gates on a DEDICATED
 * `isLocalStorageReachable()` (dev Task 8.6 adds it to `tests/support/test-env.ts`) via
 * a `skipUnlessStorage(...)` gate mirroring `skipUnlessStack`: a VISIBLE skip locally,
 * a HARD failure under `SUPABASE_TEST_REQUIRED=1`. Until Task 8.6 lands, the probe is a
 * LOCAL `notYetImplemented()` placeholder that THROWS.
 *
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * The `tenant-files` bucket, the `storage.objects` RLS policies, the storage helper,
 * the storage-reachability probe, and the object-seed factory do NOT exist yet
 * (Story 8.1 dev Tasks 1/3/4/8.6). The placeholders THROW so a mistakenly un-skipped
 * run fails LOUD; the file type-checks standalone today. The dev phase swaps the
 * placeholders for real imports and removes `.skip`.
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
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack, type SkippableTestContext } from "../../support/stack-gate";

const BUCKET = "tenant-files";

/**
 * The not-yet-built storage helpers this suite drives. RED PHASE: these THROW at call
 * time. GREEN-PHASE HAND-OFF (dev Tasks 3/4/8.6):
 *   import { isLocalStorageReachable } from "../../support/test-env";
 *   import { skipUnlessStorage } from "../../support/stack-gate";
 *   import { adminUploadStorageObject } from "../../factories/tenants";
 * and drop these placeholders + the `.skip`.
 */
function notYetImplemented(): {
  isLocalStorageReachable(): Promise<boolean>;
  skipUnlessStorage(ctx: SkippableTestContext, storageUp: boolean): boolean;
  adminUploadStorageObject(seed: {
    bucket: string;
    objectPath: string;
    body: Uint8Array;
  }): Promise<void>;
} {
  throw new Error(
    "Story 8.1 RED PHASE: isLocalStorageReachable / skipUnlessStorage / " +
      "adminUploadStorageObject are not implemented yet (Task 8.6 / factory). Remove " +
      "`.skip` and import the real surfaces in the dev phase.",
  );
}

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin's authed anon-key storage client
let anon: TestServerClient;
let tenantBObjectPath: string; // {tenantB.id}/{fileId}/name — the cross-tenant target

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  const { isLocalStorageReachable, adminUploadStorageObject } = notYetImplemented();
  storageUp = await isLocalStorageReachable();
  if (!storageUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
  // Seed a REAL Tenant-B object under B's tenant path (service-role path) so the
  // cross-tenant/read/sign negatives target a concrete object — never a missing key.
  tenantBObjectPath = `${fixture.tenantB.id}/${crypto.randomUUID()}/secret.pdf`;
  await adminUploadStorageObject({
    bucket: BUCKET,
    objectPath: tenantBObjectPath,
    body: new TextEncoder().encode("tenant-b-bytes"),
  });
  if (!tenantBObjectPath) {
    throw new Error(
      "storage isolation seed produced no object path — the cross-tenant negatives " +
        "would deny VACUOUSLY.",
    );
  }
});

afterAll(async () => {
  if (stackUp && storageUp && fixture) await cleanupFixture(fixture);
});

/** Combined gate: skip when the DB stack OR the Storage service is unreachable. */
function skipUnlessBoth(ctx: SkippableTestContext): boolean {
  if (skipUnlessStack(ctx, stackUp)) return true;
  const { skipUnlessStorage } = notYetImplemented();
  return skipUnlessStorage(ctx, storageUp);
}

describe.skip("storage.objects tenant-path isolation (AC4/AC6, R-805/R-806)", () => {
  it("[P0] Tenant A CANNOT list a Tenant-B object under {tenantB.id}/…", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // A `list` scoped to B's tenant folder returns nothing for A (RLS invisibility).
    const { data, error } = await a.storage
      .from(BUCKET)
      .list(fixture.tenantB.id);
    // Either a hard error or an empty listing — A must not SEE B's object.
    const names = (data ?? []).map((o) => o.name);
    expect(names).not.toContain(tenantBObjectPath.split("/").pop());
    // (error may or may not be set depending on platform; the invisibility is the contract.)
    void error;
  });

  it("[P0] Tenant A CANNOT download a Tenant-B object directly", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const { data, error } = await a.storage.from(BUCKET).download(tenantBObjectPath);
    // Denied: no bytes returned to A.
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("[P0/R-805] a PATH SPOOF — Tenant A signing {tenantB.id}/… — is denied by storage RLS", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // Even though A crafts B's exact object path, `storage.objects` RLS keys on the
    // first path segment (B's tenant id) → A cannot sign it.
    const { data, error } = await a.storage
      .from(BUCKET)
      .createSignedUrl(tenantBObjectPath, 60);
    expect(data?.signedUrl ?? null).toBeNull();
    expect(error).not.toBeNull();
  });

  it("[P0] a MALFORMED (non-uuid) first path segment is denied (uuid cast fails)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const { data, error } = await a.storage
      .from(BUCKET)
      .createSignedUrl(`not-a-uuid/${crypto.randomUUID()}/x.pdf`, 60);
    expect(data?.signedUrl ?? null).toBeNull();
    expect(error).not.toBeNull();
  });

  it("[P0] anon CANNOT list/read/sign any object", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const list = await anon.storage.from(BUCKET).list(fixture.tenantB.id);
    expect((list.data ?? []).length).toBe(0);
    const dl = await anon.storage.from(BUCKET).download(tenantBObjectPath);
    expect(dl.data).toBeNull();
    const sign = await anon.storage.from(BUCKET).createSignedUrl(tenantBObjectPath, 60);
    expect(sign.data?.signedUrl ?? null).toBeNull();
  });

  it("[P0/R-806] an EXPIRED signed URL no longer authorizes (low TTL)", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    // Seed A's OWN object, sign with a 1s TTL, wait past it, assert the URL 401s.
    // (The dev phase drives the TTL via SUPABASE_SIGNED_URL_TTL_SECONDS; the wait is
    // kept ≤2s per R-806. The signed URL is a plain fetch — no auth header.)
    const { adminUploadStorageObject } = notYetImplemented();
    const ownPath = `${fixture.tenantA.id}/${crypto.randomUUID()}/own.pdf`;
    await adminUploadStorageObject({
      bucket: BUCKET,
      objectPath: ownPath,
      body: new TextEncoder().encode("a-bytes"),
    });
    const { data } = await a.storage.from(BUCKET).createSignedUrl(ownPath, 1);
    expect(data?.signedUrl).toBeTruthy();
    const url = data!.signedUrl;
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(url);
    expect(res.ok).toBe(false); // expired → 400/401, no bytes
  });
});
