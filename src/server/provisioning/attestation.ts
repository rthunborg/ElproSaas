import { createHmac, timingSafeEqual } from "node:crypto";

/** Internal-only dual-proof envelope for the provisioning RPC. */
export const PROVISIONING_ATTESTATION_DOMAIN = "elpro.provisioning.attestation.v1";

export type ProvisioningAttestation = {
  readonly action: string;
  readonly actorUserId: string;
  readonly requestId: string;
  readonly requestHash: string;
  readonly organizationNumber: string;
  readonly previewHash: string;
  /** The server-derived canonical first-admin comparison key. */
  readonly firstAdminEmail: string;
  /** Execution/renewal approval is authority and must be HMAC-bound. */
  readonly explicitApproval: boolean;
  readonly baselineId: string;
  readonly baselineVersion: number;
  readonly baselineContentHash: string;
  readonly tokenHash: string;
  readonly reservationId: string;
  readonly dispatchGeneration: number;
  readonly approvalGeneration: number;
  readonly outcome: string;
  readonly keyId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

function canonical(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return new TextEncoder().encode(`${bytes.byteLength}:${value}`);
}

/** Must stay byte-for-byte aligned with public.provisioning_attestation_payload. */
export function canonicalProvisioningAttestationBytes(value: ProvisioningAttestation): Uint8Array {
  const fields = [
    PROVISIONING_ATTESTATION_DOMAIN, value.action, value.actorUserId, value.requestId,
    value.requestHash, value.organizationNumber, value.previewHash, value.firstAdminEmail,
    String(value.explicitApproval), value.baselineId,
    String(value.baselineVersion), value.baselineContentHash, value.tokenHash,
    value.reservationId, String(value.dispatchGeneration), String(value.approvalGeneration),
    value.outcome, value.keyId, value.issuedAt, value.expiresAt,
  ].map(canonical);
  const output = new Uint8Array(fields.reduce((sum, field) => sum + field.byteLength, 0));
  let offset = 0;
  for (const field of fields) { output.set(field, offset); offset += field.byteLength; }
  return output;
}

export function provisioningAttestationSecretFromEnv(): { keyId: string; secret: string } {
  const keyId = process.env.TENANT_PROVISIONING_ATTESTATION_KEY_ID;
  const secret = process.env.TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET;
  if (!keyId || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || !secret || Buffer.byteLength(secret) < 32) {
    throw new Error("provisioning attestation is not configured");
  }
  return { keyId, secret };
}

export function signProvisioningAttestation(value: ProvisioningAttestation, secret: string): string {
  return createHmac("sha256", secret).update(canonicalProvisioningAttestationBytes(value)).digest("hex");
}

export function verifyProvisioningAttestation(value: ProvisioningAttestation, secret: string, signature: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signProvisioningAttestation(value, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
}
