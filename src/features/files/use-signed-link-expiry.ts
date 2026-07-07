"use client";

/**
 * Shared client hook for the signed-link expiry→refresh contract (Story 8.3, extracted for the
 * epic-8 review finding: the `/files` index row diverged from the shared row's timer machinery).
 *
 * Given a per-file `SignedAccessState`, this returns:
 *   - `hasFreshLink` — a signed URL is present AND still within its TTL (render the open link);
 *   - `linkExpired`  — a signed URL was minted but its TTL has PASSED (hide the stale URL, offer
 *     "open again"; the stale URL is NEVER reused — re-invoking the action re-runs the full auth).
 *
 * It arms ONE bounded wall-clock `setTimeout` per active link so a link that ages out flips to the
 * expired affordance WITHOUT a full panel re-render, exactly like the shared `FilePreviewRow`. The
 * decision itself is the PURE `isSignedUrlExpired` (unit-covered); this hook only supplies the
 * wall-clock tick React needs. No re-sign, no cached/reused URL (R-810).
 */
import { useEffect, useState } from "react";
import {
  isSignedUrlExpired,
  type SignedAccessState,
} from "@/features/files/signed-access-state";

export interface SignedLinkExpiry {
  /** A signed URL is present AND still within its TTL — render the open link. */
  readonly hasFreshLink: boolean;
  /** A signed URL was minted but its TTL has passed — hide the stale URL, offer "open again". */
  readonly linkExpired: boolean;
}

/**
 * PURE derivation of the fresh/expired render verdict for a per-file signed-access `state` as of
 * `nowIso`. Only a SUCCESS state with a URL can be fresh-or-expired; idle/error is neither. Split
 * out (no wall-clock read) so `node --test` covers every branch — this is the exact decision that
 * drives BOTH the shared `FilePreviewRow` and the `/files` index row (epic-8 review finding).
 */
export function deriveSignedLinkExpiry(
  state: SignedAccessState,
  nowIso: string,
): SignedLinkExpiry {
  const hasSignedUrl = state.status === "success" && state.signedUrl !== null;
  const expired = isSignedUrlExpired(state.expiresAt, nowIso);
  return {
    hasFreshLink: hasSignedUrl && !expired,
    linkExpired: hasSignedUrl && expired,
  };
}

export function useSignedLinkExpiry(state: SignedAccessState): SignedLinkExpiry {
  // Re-evaluate the expiry verdict on a wall-clock tick so a link that ages out flips to the
  // "open again" affordance WITHOUT a full re-render. One bounded timer per active link.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.status !== "success" || state.expiresAt === null) return;
    const expiryMs = Date.parse(state.expiresAt);
    if (!Number.isFinite(expiryMs)) return;
    const remaining = expiryMs - Date.now();
    const timer = setTimeout(() => setNowMs(Date.now()), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [state.status, state.expiresAt]);

  return deriveSignedLinkExpiry(state, new Date(nowMs).toISOString());
}
