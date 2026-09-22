import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { decodeOperatorPreviewGrant, encodeOperatorPreviewGrant, samePreviewGrantActor } from "./operator-preview-grant-crypto";

const PREFIX = "operator_reconciliation_grant_";
const MAX_AGE_SECONDS = 2 * 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(): Buffer | null {
  const secret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  return typeof secret === "string" && secret.length >= 32
    ? createHash("sha256").update(secret).digest()
    : null;
}

/** A reconciliation acknowledgement is one-use, actor-bound and opaque. It
 * carries no protocol hash or retry identity in a browser form. */
export async function writeOperatorReconciliationGrant(actorUserId: string, tenantId: string): Promise<string | null> {
  const encryptionKey = key();
  if (!encryptionKey || !uuid.test(tenantId)) return null;
  const handle = randomBytes(18).toString("base64url");
  const encoded = encodeOperatorPreviewGrant({ actorUserId, request: { tenantId }, previewHash: "0".repeat(64), expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 }, encryptionKey);
  if (!encoded) return null;
  (await cookies()).set(`${PREFIX}${handle}`, encoded, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/operator", maxAge: MAX_AGE_SECONDS });
  return handle;
}

export async function takeOperatorReconciliationGrant(actorUserId: string, handle: unknown): Promise<string | null> {
  const encryptionKey = key();
  if (!encryptionKey || typeof handle !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(handle)) return null;
  const store = await cookies();
  const name = `${PREFIX}${handle}`;
  const encoded = store.get(name)?.value;
  store.delete({ name, path: "/operator" });
  if (!encoded) return null;
  const grant = decodeOperatorPreviewGrant(encoded, encryptionKey);
  const tenantId = grant?.request.tenantId;
  return grant && samePreviewGrantActor(grant.actorUserId, actorUserId) && typeof tenantId === "string" && uuid.test(tenantId)
    ? tenantId
    : null;
}
