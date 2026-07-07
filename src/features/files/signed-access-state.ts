/**
 * The entity-file signed-access UI-state contract + the pure expiry/refresh DECISION
 * (Story 8.3, Task 1.1/1.2/1.3). The `useActionState` shape for the per-file
 * preview/download affordance on an `EntityFilePanel` row — maps the
 * `createSignedFileAccess` command's `Result` to a UI-renderable shape WITHOUT leaking
 * internal detail.
 *
 * This is the THIRD instance of the signed-preview state family — it MIRRORS
 * `src/features/jobs/evidence-preview-state.ts` VERBATIM in shape (the job evidence preview,
 * 7.3) and the quote-PDF preview (6.3). Do NOT invent a new mechanism; the SERVER command
 * (`createSignedFileAccess`) is the ONLY signing funnel (R-814 STOP).
 *
 * The signed URL lives ONLY in this state — NEVER logged, NEVER a public URL, NEVER
 * persisted. A `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` maps to a generic Swedish message
 * (user-safe, NO existence disclosure — R-809); a transient `SERVER_ERROR` is a RETRYABLE
 * failure. An error state NEVER carries a `signedUrl` (metadata-first, storage-second —
 * R-810).
 *
 * ── EXPIRY/REFRESH BOUNDARY (Task 1.3 — read before caching a URL) ────────────────────────
 * The pure helpers below (`isSignedUrlExpired` / `shouldReauthorize`) decide WHEN the client
 * offers a "your link expired — press to re-open" affordance. They NEVER re-sign and NEVER
 * cache/reuse a stale URL. The authorization decision — a file whose lifecycle changed to
 * archived/deleted (or whose ownership is no longer visible) between the first sign and the
 * retry is NOT re-signed — belongs to the COMMAND, which re-runs `loadFileForAccess` +
 * `isAccessEligibleLifecycle` on EVERY call. So a refresh is achieved by RE-INVOKING the
 * command (a fresh full auth), never by re-issuing the URL these helpers gate. Do NOT reuse a
 * URL for which `isSignedUrlExpired` returns true — re-submit the form instead.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

export type SignedAccessStatus = "idle" | "success" | "error";

export interface SignedAccessState {
  readonly status: SignedAccessStatus;
  readonly code: CommandErrorCode | null;
  readonly formError: string | null;
  /** The short-lived signed URL for the file on success (NEVER on an error — R-809). */
  readonly signedUrl: string | null;
  /** The ISO expiry of the signed URL on success. */
  readonly expiresAt: string | null;
}

export const SIGNED_ACCESS_INITIAL: SignedAccessState = {
  status: "idle",
  code: null,
  formError: null,
  signedUrl: null,
  expiresAt: null,
};

/**
 * True iff the signed URL whose expiry is `expiresAt` is expired as of `nowIso`.
 *
 * A signed URL is valid STRICTLY BEFORE its expiry instant — the boundary instant itself is
 * treated as expired (`expiresAt <= now` ⇒ expired). A `null` expiry means we hold no
 * in-window URL at all, so it is treated as expired ("must (re)authorize"). An unparseable
 * `expiresAt`/`nowIso` fails toward expired (re-authorize) rather than serving a stale URL.
 *
 * PURE — no wall-clock read (both instants are passed in), so `node --test` covers every
 * branch (null / past / future / exactly-at-boundary).
 */
export function isSignedUrlExpired(
  expiresAt: string | null,
  nowIso: string,
): boolean {
  if (expiresAt === null) return true;
  const expiryMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowIso);
  // Unparseable instants ⇒ fail toward "expired" (never serve a possibly-stale URL).
  if (!Number.isFinite(expiryMs) || !Number.isFinite(nowMs)) return true;
  // Valid strictly BEFORE expiry — the boundary instant is expired.
  return expiryMs <= nowMs;
}

/**
 * True iff the client should OFFER the "(re)authorize / open again" affordance for a file,
 * given the current per-file `state` and `nowIso`:
 *   - an `idle` state (no URL minted yet) → true (offer the initial "open" action);
 *   - an `error` state → true (offer a retry — the command re-runs the full auth);
 *   - a `success` state whose `expiresAt` has PASSED (via {@link isSignedUrlExpired}) → true
 *     (the stale URL is NOT reused — re-submit the form for a fresh full auth);
 *   - a `success` state whose URL is still in-window → false (the current URL is usable — do
 *     NOT re-sign).
 *
 * PURE decision only. This NEVER re-signs and NEVER caches a URL; the re-authorization teeth
 * (a lifecycle-changed file is not re-signed) are the COMMAND's on the actual re-invocation
 * (Task 1.3).
 */
export function shouldReauthorize(
  state: SignedAccessState,
  nowIso: string,
): boolean {
  if (state.status === "success") {
    return isSignedUrlExpired(state.expiresAt, nowIso);
  }
  // idle / error → offer the (re)authorize control.
  return true;
}
