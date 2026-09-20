import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { decodeOperatorPreviewGrant, encodeOperatorPreviewGrant, samePreviewGrantActor, type OperatorPreviewGrant } from "./operator-preview-grant-crypto";

const COOKIE_PREFIX = "operator_preview_grant_";
const MAX_AGE_SECONDS = 5 * 60;

function key(): Buffer | null {
  const secret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  return typeof secret === "string" && secret.length >= 32
    ? createHash("sha256").update(secret).digest()
    : null;
}

/**
 * Browser-visible preview state never receives the request or raw hash. Each
 * preview gets its own opaque handle and encrypted HttpOnly grant, so a second
 * tab cannot replace the specific preview being approved in the first tab.
 */
export async function writeOperatorPreviewGrant(actorUserId: string, request: Record<string, unknown>, previewHash: string): Promise<string | null> {
  const encryptionKey = key();
  if (!encryptionKey) return null;
  const value = encodeOperatorPreviewGrant({ actorUserId, request, previewHash, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 }, encryptionKey);
  if (!value) return null;
  const handle = randomBytes(18).toString("base64url");
  const store = await cookies();
  store.set(`${COOKIE_PREFIX}${handle}`, value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/operator", maxAge: MAX_AGE_SECONDS });
  return handle;
}

/** Consume on approval so a captured form submit cannot replay the same preview. */
export async function takeOperatorPreviewGrant(actorUserId: string, handle: unknown): Promise<Pick<OperatorPreviewGrant, "request" | "previewHash"> | null> {
  const encryptionKey = key();
  const store = await cookies();
  if (typeof handle !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(handle)) return null;
  const cookieName = `${COOKIE_PREFIX}${handle}`;
  const encoded = store.get(cookieName)?.value;
  // Deletion must use the creation path. Omitting it emits a root-path cookie
  // and leaves the /operator grant replayable in browsers.
  store.delete({ name: cookieName, path: "/operator" });
  if (!encryptionKey || !encoded) return null;
  const grant = decodeOperatorPreviewGrant(encoded, encryptionKey);
  if (!grant || !samePreviewGrantActor(grant.actorUserId, actorUserId)) return null;
  return { request: grant.request, previewHash: grant.previewHash };
}
