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
 * ── WHY `describe.skip` (RED PHASE) ─────────────────────────────────────────────
 * `@/server/commands/files` (createSignedFileAccess), `@/server/storage/*`, the
 * `FILE_ACCESS_DENIED` command code, the `files` migration, and the file factory
 * seeds do NOT exist yet (Story 8.1 dev Tasks 2/4/5/7). The `notYetImplemented()`
 * placeholders THROW so a mistakenly un-skipped run fails LOUD; the file type-checks
 * standalone today. The dev phase swaps the placeholders for real imports and removes
 * `.skip`.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
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
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-04T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/**
 * The not-yet-built surfaces this suite drives. RED PHASE: these THROW at call time.
 * GREEN-PHASE HAND-OFF (dev):
 *   import { createSignedFileAccess } from "@/server/commands/files";
 *   import { adminInsertFile } from "../../factories/tenants";
 * and drop these placeholders + the `.skip`.
 */
type FileSeed = {
  tenant_id: string;
  display_name: string;
  lifecycle_state?: "draft" | "linked" | "locked" | "archived" | "deleted";
};
function notYetImplemented(): {
  createSignedFileAccess: unknown;
  adminInsertFile: (seed: FileSeed) => Promise<string>;
} {
  throw new Error(
    "Story 8.1 RED PHASE: createSignedFileAccess + adminInsertFile are not " +
      "implemented yet. Remove `.skip` and import the real surfaces in the dev phase " +
      "(Tasks 2/4/5/7).",
  );
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin's authenticated anon-key client
let anon: TestServerClient; // unauthenticated client
let ownFileId: string; // A's own draft/linked file (access-eligible)
let archivedFileId: string; // A's own archived file (lifecycle-ineligible)
let tenantBFileId: string; // a REAL Tenant B file (cross-tenant target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  anon = await makeAnonServerClient();
  const { adminInsertFile } = notYetImplemented();
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
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("createSignedFileAccess authorization matrix (AC5/AC6/AC8)", () => {
  it("[P0] happy own-tenant sign SUCCEEDS → signedUrl + expiresAt", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createSignedFileAccess } = notYetImplemented();
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
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createSignedFileAccess } = notYetImplemented();
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
    const { createSignedFileAccess } = notYetImplemented();
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
    const { createSignedFileAccess } = notYetImplemented();
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
    const { createSignedFileAccess } = notYetImplemented();
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
    const { createSignedFileAccess } = notYetImplemented();
    const result = await runCommand(createSignedFileAccess as never, {
      client: a as never,
      input: { file_id: archivedFileId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    // The lifecycle gate runs on an OWNED file — a file-specific denial, before any
    // createSignedUrl call. (FILE_ACCESS_DENIED is added to command-errors.ts in dev
    // Task 5.4.)
    if (!result.ok) expect(result.code).toBe("FILE_ACCESS_DENIED");
  });

  it("[P0/AC5] the archived-file rejection does NOT issue a signed URL", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const { createSignedFileAccess } = notYetImplemented();
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
