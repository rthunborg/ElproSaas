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
 * The MAX signed-URL TTL (seconds) — a hard ceiling so a misconfigured huge env value
 * cannot mint an effectively unbounded-lifetime signed URL, contradicting the R-806
 * low-TTL contract. 24h is a generous but bounded upper limit for a short-lived access
 * URL; a value above it falls back to the safe DEFAULT (fail toward the tighter TTL).
 */
export const MAX_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

/**
 * Resolve the signed-URL TTL (seconds) from `SUPABASE_SIGNED_URL_TTL_SECONDS`, falling
 * back to {@link DEFAULT_SIGNED_URL_TTL_SECONDS} when unset, non-numeric, ≤ 0, or above
 * the {@link MAX_SIGNED_URL_TTL_SECONDS} ceiling (a misconfigured huge value must NOT
 * mint an unbounded-lifetime URL — R-806). A low value in the test env drives the
 * expiry test. Kept pure/exported for unit testing.
 */
export function resolveSignedUrlTtlSeconds(
  raw: string | undefined = process.env.SUPABASE_SIGNED_URL_TTL_SECONDS,
): number {
  if (raw === undefined) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  // Clamp an over-large TTL back to the safe default (fail toward the tighter bound so a
  // fat-fingered env value can never issue a near-permanent URL).
  if (n > MAX_SIGNED_URL_TTL_SECONDS) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  return n;
}

/** A Supabase storage error (the fields we inspect to classify permanent vs transient). */
export type StorageSigningError = {
  readonly message?: string;
  /** HTTP status (supabase-js exposes it as `status`; the REST layer as `statusCode`). */
  readonly status?: number;
  readonly statusCode?: number | string;
  /** The structured error code (e.g. `NoSuchKey`, `AccessDenied`, `InternalError`). */
  readonly code?: string;
  readonly error?: string;
  readonly name?: string;
};

/** The minimal storage surface the wrapper drives (request-bound RLS client). */
export type StorageSigningClient = {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{
        data: { signedUrl: string } | null;
        error: StorageSigningError | null;
      }>;
    };
  };
};

/**
 * Classify a storage signing error as PERMANENT (no object / RLS-denied → the caller
 * maps it to a user-safe `FILE_ACCESS_DENIED`) vs TRANSIENT (5xx / network / unknown →
 * re-thrown so the envelope maps it to a retryable `SERVER_ERROR`, never masked as a
 * permanent access denial — the same discipline the envelope's `verifyOwnership` applies
 * to the DB case).
 *
 * A permanent denial is a NON-retryable 4xx status (e.g. 403/404) OR a known
 * not-found/denied error code. Anything else — a 5xx, a RETRYABLE 4xx (408 Request
 * Timeout / 425 Too Early / 429 Too Many Requests), a missing/ambiguous status, a
 * network reject — is treated as TRANSIENT (fail toward observability/retry, not toward
 * a silent permanent denial). A storage rate-limit spike (429) or gateway timeout (408)
 * must surface as a retryable SERVER_ERROR, never a permanent "file cannot be accessed".
 */
/**
 * Retryable 4xx status codes — a transient rate-limit / timeout the caller may retry.
 * These are EXCLUDED from the permanent-denial branch so they re-throw → SERVER_ERROR.
 */
const RETRYABLE_4XX = new Set<number>([408, 425, 429]);

export function isPermanentStorageDenial(error: StorageSigningError): boolean {
  const rawStatus = error.status ?? error.statusCode;
  const status =
    typeof rawStatus === "string" ? Number(rawStatus) : rawStatus;
  if (typeof status === "number" && Number.isFinite(status)) {
    // A 4xx is a permanent client/permission denial UNLESS it is a retryable transient
    // (408/425/429); 5xx are transient server faults.
    return status >= 400 && status < 500 && !RETRYABLE_4XX.has(status);
  }
  // No usable status — fall back to the structured code / legacy identifier.
  const code = (error.code ?? error.error ?? "").toLowerCase();
  const PERMANENT_CODES = new Set([
    "nosuchkey",
    "nosuchbucket",
    "accessdenied",
    "not_found",
    "unauthorized",
  ]);
  if (code && PERMANENT_CODES.has(code)) return true;
  // Unknown/ambiguous → TRANSIENT (re-throw → SERVER_ERROR).
  return false;
}

/** The result of a successful signing: the URL + the computed expiry instant. */
export interface SignedAccess {
  readonly signedUrl: string;
  /** ISO instant the URL expires (now + ttl), computed from the command clock. */
  readonly expiresAt: string;
}

/**
 * Create a short-lived signed URL for `objectPath` in `bucket` under the CALLER's RLS
 * client.
 *
 * Returns `null` ONLY for a PERMANENT denial — a missing object or an RLS-denied
 * signing attempt (a 4xx / known not-found/denied error) — which the caller maps to a
 * generic user-safe `FILE_ACCESS_DENIED`. A TRANSIENT storage fault (5xx / network /
 * unknown) is RE-THROWN as a plain Error so the envelope maps it to a retryable
 * `SERVER_ERROR` — a transient Storage outage must NEVER collapse into a permanent,
 * non-retryable access denial (the same discipline `verifyOwnership` applies to the DB
 * case). NEVER a raw storage error across the boundary.
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
  if (error) {
    // A permanent no-object / RLS-denied error → null → FILE_ACCESS_DENIED. A transient
    // (5xx/network/ambiguous) error → re-throw → SERVER_ERROR (retryable, correct
    // observability). A raw message never crosses the boundary.
    if (isPermanentStorageDenial(error)) {
      return null;
    }
    throw new Error(
      `storage signing failed (transient): ${error.code ?? error.status ?? "?"}`,
    );
  }
  if (!data || typeof data.signedUrl !== "string") {
    // No error but no URL — treat as a permanent no-object denial (nothing to retry).
    return null;
  }
  const expiresAt = new Date(
    new Date(opts.nowIso).getTime() + ttl * 1000,
  ).toISOString();
  return { signedUrl: data.signedUrl, expiresAt };
}
