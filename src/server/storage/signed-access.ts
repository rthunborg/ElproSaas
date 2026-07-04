/**
 * Signed-access storage wrapper (Story 8.1, Task 4.2; architecture §6, R-806/R-810/
 * R-815).
 *
 * A thin wrapper over `client.storage.from(bucket).createSignedUrl(objectPath, ttl)`
 * driven by the REQUEST-BOUND anon-key RLS client (the same `@supabase/ssr` server
 * client / test anon-key client the command envelope uses). Signing therefore runs
 * under the CALLER's session + `storage.objects` RLS — NEVER a service-role key (the
 * containment guard). The app uses NO service-role key on any path.
 *
 * The TTL is read from `SUPABASE_SIGNED_URL_TTL_SECONDS` (documented in
 * `.env.example`) with a safe default (300s). A LOW value in the test env makes the
 * expiry testable without a long sleep (R-806) — a HARDCODED TTL would block that
 * test. The wrapper NEVER exposes the raw bucket/object path beyond the signed URL the
 * command returns (R-810).
 */

/** The default signed-URL TTL (seconds) when the env var is unset/invalid. */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/**
 * Resolve the signed-URL TTL (seconds) from `SUPABASE_SIGNED_URL_TTL_SECONDS`, falling
 * back to {@link DEFAULT_SIGNED_URL_TTL_SECONDS} when unset, non-numeric, or ≤ 0. A low
 * value in the test env drives the expiry test (R-806). Kept pure/exported for unit
 * testing.
 */
export function resolveSignedUrlTtlSeconds(
  raw: string | undefined = process.env.SUPABASE_SIGNED_URL_TTL_SECONDS,
): number {
  if (raw === undefined) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  return n;
}

/** The minimal storage surface the wrapper drives (request-bound RLS client). */
export type StorageSigningClient = {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{
        data: { signedUrl: string } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

/** The result of a successful signing: the URL + the computed expiry instant. */
export interface SignedAccess {
  readonly signedUrl: string;
  /** ISO instant the URL expires (now + ttl), computed from the command clock. */
  readonly expiresAt: string;
}

/**
 * Create a short-lived signed URL for `objectPath` in `bucket` under the CALLER's RLS
 * client. Returns `null` on any storage error or missing URL (the caller maps that to
 * a generic user-safe denial — NEVER a raw storage error across the boundary).
 *
 * `nowIso` is the single command instant (from `ctx.clock.now()`); `expiresAt` is
 * `now + ttl` so the caller can return a deterministic expiry without reading the wall
 * clock again. `storage.objects` RLS still enforces tenant isolation on the sign — a
 * cross-tenant / path-spoof object is denied by the DB, not by this wrapper.
 */
export async function createSignedFileUrl(opts: {
  readonly client: StorageSigningClient;
  readonly bucket: string;
  readonly objectPath: string;
  readonly ttlSeconds?: number;
  readonly nowIso: string;
}): Promise<SignedAccess | null> {
  const ttl = opts.ttlSeconds ?? resolveSignedUrlTtlSeconds();
  const { data, error } = await opts.client.storage
    .from(opts.bucket)
    .createSignedUrl(opts.objectPath, ttl);
  if (error || !data || typeof data.signedUrl !== "string") {
    return null;
  }
  const expiresAt = new Date(
    new Date(opts.nowIso).getTime() + ttl * 1000,
  ).toISOString();
  return { signedUrl: data.signedUrl, expiresAt };
}
