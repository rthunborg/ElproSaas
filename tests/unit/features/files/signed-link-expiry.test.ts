/**
 * Story 8.5 — epic-8 review finding ([Review][Patch][Low]): the `/files` index preview row must
 * honor the SAME 8.3 expiry→refresh contract as the shared `FilePreviewRow` (a link minted in the
 * index that ages out while the row stays mounted must flip to the "open again" affordance instead
 * of staying rendered/clickable past its TTL). Both surfaces now derive that verdict from the SAME
 * pure `deriveSignedLinkExpiry`; these UNIT pins prove it:
 *   - a fresh success (URL in-window)      → hasFreshLink, NOT linkExpired;
 *   - an aged-out success (URL past TTL)    → linkExpired, NOT hasFreshLink (the stale URL is hidden);
 *   - the exact-boundary instant            → expired (valid strictly before expiry);
 *   - idle / error (no URL)                 → neither fresh nor expired.
 *
 * [Source: src/features/files/use-signed-link-expiry.ts (deriveSignedLinkExpiry, shared by
 *  FilePreviewRow + FileIndexList); src/features/files/signed-access-state.ts (isSignedUrlExpired);
 *  epic-8-review-findings.md [Review][Patch][Low]]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSignedLinkExpiry } from "@/features/files/use-signed-link-expiry";
import {
  SIGNED_ACCESS_INITIAL,
  type SignedAccessState,
} from "@/features/files/signed-access-state";

const NOW = "2026-07-07T12:00:00.000Z";

function success(expiresAt: string | null): SignedAccessState {
  return {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://example.test/signed/abc",
    expiresAt,
  };
}

test("[8-review][index-expiry] a fresh in-window link → hasFreshLink, not expired", () => {
  const v = deriveSignedLinkExpiry(success("2026-07-07T12:05:00.000Z"), NOW);
  assert.equal(v.hasFreshLink, true);
  assert.equal(v.linkExpired, false);
});

test("[8-review][index-expiry] an aged-out link → linkExpired, NOT fresh (stale URL hidden)", () => {
  // The concrete finding trigger: the TTL elapses while the row stays mounted. The row must flip
  // to the re-open affordance — never keep the stale URL rendered/clickable.
  const v = deriveSignedLinkExpiry(success("2026-07-07T11:59:59.000Z"), NOW);
  assert.equal(v.linkExpired, true);
  assert.equal(v.hasFreshLink, false);
});

test("[8-review][index-expiry] the exact expiry boundary is treated as expired", () => {
  const v = deriveSignedLinkExpiry(success(NOW), NOW);
  assert.equal(v.linkExpired, true);
  assert.equal(v.hasFreshLink, false);
});

test("[8-review][index-expiry] a null expiry (no in-window URL) is expired", () => {
  const v = deriveSignedLinkExpiry(success(null), NOW);
  assert.equal(v.linkExpired, true);
  assert.equal(v.hasFreshLink, false);
});

test("[8-review][index-expiry] idle / error states are neither fresh nor expired", () => {
  const idle = deriveSignedLinkExpiry(SIGNED_ACCESS_INITIAL, NOW);
  assert.equal(idle.hasFreshLink, false);
  assert.equal(idle.linkExpired, false);

  const error = deriveSignedLinkExpiry(
    {
      status: "error",
      code: "FILE_ACCESS_DENIED",
      formError: "nej",
      signedUrl: null,
      expiresAt: null,
    },
    NOW,
  );
  assert.equal(error.hasFreshLink, false);
  assert.equal(error.linkExpired, false);
});
