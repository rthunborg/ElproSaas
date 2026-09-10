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
  adminInsertMembership,
  adminUploadStorageObject,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminExec, adminQuery } from "../../factories/admin-sql";
import {
  isLocalStackReachable,
  isLocalStorageReachable,
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  LOCAL_TEST_QUOTE_PDF_SECRET,
} from "../../support/test-env";
import {
  skipUnlessStack,
  skipUnlessStorage,
  type SkippableTestContext,
} from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createSignedFileAccess } from "@/server/commands/files";
import type { CommandClock } from "@/server/commands/clock";
import {
  parseFileSignedAccessAuditChallenge,
  signFileSignedAccessAttestation,
  validateSignedStorageUrl,
  type FileSignedAccessAttestationPayload,
} from "@/server/storage/signed-access-attestation";
import {
  createSignedFileUrl,
  type StorageSigningClient,
} from "@/server/storage/signed-access";

const FIXED_ISO = "2026-07-04T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };
const BUCKET = "tenant-files";
const DEFAULT_TTL_SECONDS = 300;

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // Tenant A admin's authenticated anon-key client
let pm: TestServerClient; // Tenant A Project Manager's authenticated anon-key client
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

function withSigningFailure(client: TestServerClient): TestServerClient {
  const failingStorage = {
    from: () => ({
      createSignedUrl: async () => ({
        data: null,
        error: { status: 404, code: "NoSuchKey" },
      }),
    }),
  };
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "storage") return failingStorage;
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as TestServerClient;
}

async function prepareRealSignedAccessProof(opts: {
  readonly client: TestServerClient;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly fileId: string;
  readonly correlationId: string;
}): Promise<{
  readonly payload: FileSignedAccessAttestationPayload;
  readonly signature: string;
}> {
  const objectPath = await objectPathOf(opts.fileId);
  const prepared = await opts.client.rpc(
    "prepare_file_signed_access_audit_attestation",
    {
      p_tenant_id: opts.tenantId,
      p_actor_user_id: opts.actorUserId,
      p_file_id: opts.fileId,
      p_correlation_id: opts.correlationId,
      p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
    },
  );
  if (prepared.error) {
    throw new Error(`test prepare proof failed: ${prepared.error.code ?? "?"}`);
  }
  const challenge = parseFileSignedAccessAuditChallenge(prepared.data, {
    tenantId: opts.tenantId,
    fileId: opts.fileId,
    bucketId: BUCKET,
    objectPath,
    keyId: LOCAL_TEST_QUOTE_PDF_KEY_ID,
  });
  const signed = await createSignedFileUrl({
    client: opts.client as unknown as StorageSigningClient,
    bucket: challenge.bucketId,
    objectPath: challenge.objectPath,
    nowIso: challenge.issuedAt,
  });
  if (!signed) throw new Error("test proof Storage signing was denied");
  const url = validateSignedStorageUrl(signed.signedUrl, {
    bucketId: challenge.bucketId,
    objectPath: challenge.objectPath,
    challengeIssuedAt: challenge.issuedAt,
    computedExpiresAt: signed.expiresAt,
  });
  const payload: FileSignedAccessAttestationPayload = {
    tenantId: opts.tenantId,
    actorUserId: opts.actorUserId,
    fileId: opts.fileId,
    bucketId: challenge.bucketId,
    objectPath: challenge.objectPath,
    correlationId: opts.correlationId,
    signedUrlSha256: url.signedUrlSha256,
    signedUrlExpiresAt: url.expiresAt,
    keyId: challenge.keyId,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  };
  return {
    payload,
    signature: signFileSignedAccessAttestation(
      payload,
      LOCAL_TEST_QUOTE_PDF_SECRET,
    ),
  };
}

function finalizerArgs(
  payload: FileSignedAccessAttestationPayload,
  signature: string,
): Record<string, unknown> {
  return {
    p_tenant_id: payload.tenantId,
    p_actor_user_id: payload.actorUserId,
    p_file_id: payload.fileId,
    p_bucket_id: payload.bucketId,
    p_object_path: payload.objectPath,
    p_correlation_id: payload.correlationId,
    p_signed_url_sha256: payload.signedUrlSha256,
    p_signed_url_expires_at: payload.signedUrlExpiresAt,
    p_attestation_key_id: payload.keyId,
    p_attestation_issued_at: payload.issuedAt,
    p_attestation_expires_at: payload.expiresAt,
    p_attestation_signature: signature,
  };
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  fixture = await createTwoTenantFixture();
  await adminInsertMembership({
    tenant_id: fixture.tenantA.id,
    user_id: fixture.orphanUser.id,
    role: "projektledare",
    status: "active",
  });
  a = await makeAuthedServerClient(fixture.adminA);
  pm = await makeAuthedServerClient(fixture.orphanUser);
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
    const startedAt = Date.now();
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
      // The returned expiry is the actual second-precision `exp` from the Storage JWT.
      // It must be live and remain within the configured default TTL plus request skew.
      const expiresAt = Date.parse(data.expiresAt);
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(
        startedAt + (DEFAULT_TTL_SECONDS + 60) * 1000,
      );
      expect(expiresAt % 1000).toBe(0);
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
    // POSITIVE allow-list (not just a blocklist absence): the command passes no metadata
    // beyond the target id (carried in the target_id COLUMN, not metadata), so the
    // sanitized metadata object is EMPTY. Asserting the exact key set catches a stray
    // leaked field (uploaded_by / object_path / signedUrl) that a blocklist regex might
    // miss — no field can silently slip through.
    const metadata = (events[0]?.metadata ?? {}) as Record<string, unknown>;
    expect(Object.keys(metadata)).toEqual([]);
    // Belt-and-braces blocklist: still assert no path/URL/PII substring leaked.
    const meta = JSON.stringify(metadata);
    expect(meta).not.toMatch(/tenant-files|object_path|bucket|signedUrl|https?:\/\//i);
  });

  it("[11.2][P0] Project Manager signs through caller RLS and receives a URL only after one fixed audit", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createSignedFileAccess as never, {
      client: pm as never,
      input: { file_id: ownFileId },
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        targetId: string;
        signedUrl: string;
        expiresAt: string;
      };
      expect(data.targetId).toBe(ownFileId);
      expect(data.signedUrl).toMatch(/\/storage\/v1\/object\/sign\//);
      expect(Date.parse(data.expiresAt)).toBeGreaterThan(Date.now());
    }
    const events = await adminSelectAuditEvents({ correlationId });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.orphanUser.id,
      command: "file.signedAccess.create",
      event_type: "file.signed_access.created",
      target_type: "file",
      target_id: ownFileId,
      metadata: {},
    });
  });

  it("[11.2][P0] a Storage signing failure writes no audit and exposes no URL", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createSignedFileAccess as never, {
      client: withSigningFailure(pm) as never,
      input: { file_id: ownFileId },
      correlationId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_ACCESS_DENIED");
      expect((result as { data?: unknown }).data).toBeUndefined();
    }
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
  });

  it("[11.2][P0] an audit failure after real Storage signing returns no URL and writes no audit", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    await adminExec(
      `insert into test_support.forced_audit_failures (correlation_id)
       values ($1::uuid)`,
      [correlationId],
    );
    try {
      const result = await runCommand(createSignedFileAccess as never, {
        client: pm as never,
        input: { file_id: ownFileId },
        correlationId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER_ERROR");
        expect((result as { data?: { signedUrl?: string } }).data?.signedUrl).toBeUndefined();
      }
      expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
    } finally {
      await adminExec(
        `delete from test_support.forced_audit_failures
          where correlation_id = $1::uuid`,
        [correlationId],
      );
    }
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

  it("[11.2][P0] direct RPC actor spoof and cross-tenant preparation are rejected before proof issuance", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const spoofCorrelation = crypto.randomUUID();
    const spoof = await pm.rpc(
      "prepare_file_signed_access_audit_attestation",
      {
        p_tenant_id: fixture.tenantA.id,
        p_actor_user_id: fixture.adminA.id,
        p_file_id: ownFileId,
        p_correlation_id: spoofCorrelation,
        p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      },
    );
    expect(spoof.data).toBeNull();
    expect(spoof.error?.code).toBe("42501");
    expect(await adminSelectAuditEvents({ correlationId: spoofCorrelation })).toEqual([]);

    const crossTenantCorrelation = crypto.randomUUID();
    const crossTenant = await pm.rpc(
      "prepare_file_signed_access_audit_attestation",
      {
        p_tenant_id: fixture.tenantB.id,
        p_actor_user_id: fixture.orphanUser.id,
        p_file_id: tenantBFileId,
        p_correlation_id: crossTenantCorrelation,
        p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      },
    );
    expect(crossTenant.data).toBeNull();
    expect(crossTenant.error?.code).toBe("42501");
    expect(
      await adminSelectAuditEvents({ correlationId: crossTenantCorrelation }),
    ).toEqual([]);
  });

  it("[11.2][P0] forged and tampered post-signing proofs cannot fabricate a success audit", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const proof = await prepareRealSignedAccessProof({
      client: pm,
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.orphanUser.id,
      fileId: ownFileId,
      correlationId,
    });

    const attempts = [
      finalizerArgs(proof.payload, "0".repeat(64)),
      {
        ...finalizerArgs(proof.payload, proof.signature),
        p_signed_url_sha256: "b".repeat(64),
      },
      {
        ...finalizerArgs(proof.payload, proof.signature),
        p_object_path: `${fixture.tenantA.id}/${ownFileId}/spoof.pdf`,
      },
      {
        ...finalizerArgs(proof.payload, proof.signature),
        p_signed_url_expires_at: new Date(
          Date.parse(proof.payload.signedUrlExpiresAt) + 1000,
        ).toISOString(),
      },
    ];
    for (const args of attempts) {
      const rejected = await pm.rpc(
        "record_file_signed_access_audit_attested",
        args,
      );
      expect(rejected.data).toBeNull();
      expect(rejected.error?.code).toBe("FSA10");
    }
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
  });

  it("[11.2][P0] expired attestation is rejected even when its HMAC is otherwise valid", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const current = await prepareRealSignedAccessProof({
      client: pm,
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.orphanUser.id,
      fileId: ownFileId,
      correlationId,
    });
    const issuedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const expiredPayload: FileSignedAccessAttestationPayload = {
      ...current.payload,
      issuedAt,
      expiresAt: new Date(Date.parse(issuedAt) + 5 * 60 * 1000).toISOString(),
    };
    const expired = await pm.rpc(
      "record_file_signed_access_audit_attested",
      finalizerArgs(
        expiredPayload,
        signFileSignedAccessAttestation(
          expiredPayload,
          LOCAL_TEST_QUOTE_PDF_SECRET,
        ),
      ),
    );
    expect(expired.data).toBeNull();
    expect(expired.error?.code).toBe("FSA10");
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
  });

  it("[11.2][P0] a valid proof is consumed once and exact replay cannot add a second audit", async (testCtx) => {
    if (skipUnlessBoth(testCtx)) return;
    const correlationId = crypto.randomUUID();
    const proof = await prepareRealSignedAccessProof({
      client: pm,
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.orphanUser.id,
      fileId: ownFileId,
      correlationId,
    });
    const args = finalizerArgs(proof.payload, proof.signature);
    const first = await pm.rpc(
      "record_file_signed_access_audit_attested",
      args,
    );
    expect(first.error).toBeNull();
    expect(typeof first.data).toBe("string");

    const replay = await pm.rpc(
      "record_file_signed_access_audit_attested",
      args,
    );
    expect(replay.data).toBeNull();
    expect(replay.error?.code).toBe("FSA10");
    const events = await adminSelectAuditEvents({ correlationId });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenant_id: fixture.tenantA.id,
      actor_user_id: fixture.orphanUser.id,
      command: "file.signedAccess.create",
      event_type: "file.signed_access.created",
      target_type: "file",
      target_id: ownFileId,
      metadata: {},
    });
  });
});
